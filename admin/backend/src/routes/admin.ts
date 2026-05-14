import { Router } from "express";
import { z } from "zod";
import { AuditLog } from "../models/AuditLog";
import { Message } from "../models/Message";
import { Report } from "../models/Report";
import { Thread } from "../models/Thread";
import { User } from "../models/User";

const router = Router();

const verificationStatusSchema = z.enum(["pending", "approved", "rejected"]);
const reportStatusSchema = z.enum(["pending", "resolved", "dismissed"]);

const reviewVerificationSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNote: z.string().max(500).optional(),
}).refine((value) => value.status === "approved" || Boolean(value.reviewNote?.trim()), {
  message: "Rejection reason is required",
  path: ["reviewNote"],
});

const reviewReportSchema = z.object({
  status: z.enum(["resolved", "dismissed", "pending"]),
});

type ActivityLog = {
  id: string;
  date: Date;
  actionType: string;
  action: string;
  actor?: string;
  actorEmail?: string;
  targetType?: string;
  target?: string;
  status?: string;
};

function parsePagination(query: { page?: unknown; limit?: unknown }) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(query.limit || 10)));
  return { page, limit, skip: (page - 1) * limit };
}

function pagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function stringifyId(value: unknown) {
  if (value && typeof value === "object" && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value || "");
}

function userName(user: unknown) {
  if (!user || typeof user !== "object") return "Unknown user";
  return String((user as { name?: unknown }).name || (user as { email?: unknown }).email || "Unknown user");
}

function userEmail(user: unknown) {
  if (!user || typeof user !== "object") return undefined;
  const email = (user as { email?: unknown }).email;
  return typeof email === "string" ? email : undefined;
}

router.get("/summary", async (_req, res, next) => {
  try {
    const [
      pendingMentors,
      pendingReports,
      approvedMentors,
      totalUsers,
    ] = await Promise.all([
      User.countDocuments({ role: "expert", "expertVerification.status": "pending" }),
      Report.countDocuments({ status: "pending" }),
      User.countDocuments({ role: "expert", "expertVerification.status": "approved" }),
      User.countDocuments(),
    ]);

    res.json({
      summary: {
        pendingMentors,
        pendingReports,
        approvedMentors,
        totalUsers,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/mentor-verifications", async (req, res, next) => {
  try {
    const status = verificationStatusSchema.optional().parse(req.query.status);
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {
      role: "expert",
      ...(status
        ? { "expertVerification.status": status }
        : { "expertVerification.status": { $in: ["pending", "approved", "rejected"] } }),
    };
    const [users, total] = await Promise.all([
      User.find(filter)
      .select("name email bio primaryTechnicalField roleOrStatus yearsOfExperience devicesUsed collaborationGoals availabilityStatus expertise skillTags expertVerification points createdAt")
      .sort({ "expertVerification.submittedAt": -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({ verifications: users, pagination: pagination(page, limit, total) });
  } catch (err) {
    next(err);
  }
});

router.patch("/mentor-verifications/:userId", async (req, res, next) => {
  try {
    const parsed = reviewVerificationSchema.parse(req.body);
    const user = await User.findOneAndUpdate(
      { _id: req.params.userId, role: "expert" },
      {
        $set: {
          "expertVerification.status": parsed.status,
          "expertVerification.reviewNote": parsed.reviewNote,
          "expertVerification.reviewedAt": new Date(),
        },
      },
      { new: true }
    ).select("name email role expertVerification expertise skillTags");

    if (!user) {
      res.status(404).json({ error: { message: "Mentor verification request not found" } });
      return;
    }

    await AuditLog.create({
      actorName: "Admin",
      actionType: "mentor_verification_reviewed",
      action: `${user.name} mentor verification was ${parsed.status}`,
      targetType: "mentor",
      targetId: user.id,
      status: parsed.status,
      metadata: { reviewNote: parsed.reviewNote },
    });

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.get("/reports", async (req, res, next) => {
  try {
    const status = reportStatusSchema.optional().parse(req.query.status);
    const { page, limit, skip } = parsePagination(req.query);
    const filter = status ? { status } : {};
    const [reports, total] = await Promise.all([
      Report.find(filter)
      .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
      .populate("reporterId", "name email")
        .lean(),
      Report.countDocuments(filter),
    ]);

    const targetIds = {
      user: reports.filter((r) => r.targetType === "user").map((r) => r.targetId),
      thread: reports.filter((r) => r.targetType === "thread").map((r) => r.targetId),
      message: reports.filter((r) => r.targetType === "message").map((r) => r.targetId),
    };

    const [users, threads, messages] = await Promise.all([
      User.find({ _id: { $in: targetIds.user } }).select("name email role").lean(),
      Thread.find({ _id: { $in: targetIds.thread } }).select("title subject status").lean(),
      Message.find({ _id: { $in: targetIds.message } }).select("body type").lean(),
    ]);

    const userTargets = new Map(users.map((user) => [String(user._id), user]));
    const threadTargets = new Map(threads.map((thread) => [String(thread._id), thread]));
    const messageTargets = new Map(messages.map((message) => [String(message._id), message]));

    const enriched = reports.map((report) => {
      const targetId = String(report.targetId);
      const target =
        report.targetType === "user"
          ? userTargets.get(targetId)
          : report.targetType === "thread"
            ? threadTargets.get(targetId)
            : messageTargets.get(targetId);

      return { ...report, target };
    });

    res.json({ reports: enriched, pagination: pagination(page, limit, total) });
  } catch (err) {
    next(err);
  }
});

router.patch("/reports/:reportId", async (req, res, next) => {
  try {
    const parsed = reviewReportSchema.parse(req.body);
    const report = await Report.findByIdAndUpdate(
      req.params.reportId,
      { $set: { status: parsed.status } },
      { new: true }
    );

    if (!report) {
      res.status(404).json({ error: { message: "Report not found" } });
      return;
    }

    await AuditLog.create({
      actorName: "Admin",
      actionType: "report_reviewed",
      action: `Report ${report.id} marked ${parsed.status}`,
      targetType: "report",
      targetId: report.id,
      status: parsed.status,
    });

    res.json({ report });
  } catch (err) {
    next(err);
  }
});

router.get("/action-logs", async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const [auditLogs, total] = await Promise.all([
      AuditLog.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(),
    ]);

    const logs: ActivityLog[] = auditLogs.map((log) => ({
      id: String(log._id),
      date: log.createdAt,
      actionType: log.actionType,
      action: log.action,
      actor: log.actorName,
      actorEmail: log.actorEmail,
      targetType: log.targetType,
      target: log.targetId,
      status: log.status,
    }));

    res.json({
      logs,
      pagination: pagination(page, limit, total),
    });
  } catch (err) {
    next(err);
  }
});

export const adminRouter = router;
