import { Router } from "express";
import { z } from "zod";
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
    const users = await User.find({
      role: "expert",
      ...(status
        ? { "expertVerification.status": status }
        : { "expertVerification.status": { $in: ["pending", "approved", "rejected"] } }),
    })
      .select("name email primaryTechnicalField roleOrStatus yearsOfExperience expertise skillTags expertVerification points createdAt")
      .sort({ "expertVerification.submittedAt": -1, createdAt: -1 })
      .lean();

    res.json({ verifications: users });
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

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.get("/reports", async (req, res, next) => {
  try {
    const status = reportStatusSchema.optional().parse(req.query.status);
    const reports = await Report.find(status ? { status } : {})
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("reporterId", "name email")
      .lean();

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

    res.json({ reports: enriched });
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

    res.json({ report });
  } catch (err) {
    next(err);
  }
});

router.get("/action-logs", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 100), 300);
    const [users, verifications, reports, threads, messages] = await Promise.all([
      User.find().sort({ createdAt: -1 }).limit(limit).select("name email role createdAt").lean(),
      User.find({ "expertVerification.submittedAt": { $exists: true } })
        .sort({ "expertVerification.submittedAt": -1 })
        .limit(limit)
        .select("name email expertVerification")
        .lean(),
      Report.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("reporterId", "name email")
        .lean(),
      Thread.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("createdBy", "name email")
        .select("title subject status createdBy createdAt")
        .lean(),
      Message.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("sender", "name email")
        .populate("thread", "title")
        .select("body type isFromAi sender thread createdAt")
        .lean(),
    ]);

    const logs: ActivityLog[] = [
      ...users.map((user) => ({
        id: `user:${stringifyId(user)}`,
        date: user.createdAt,
        actionType: "user_registered",
        action: `${user.name} registered as ${user.role}`,
        actor: user.name,
        actorEmail: user.email,
        targetType: "user",
        target: user.email,
        status: user.role,
      })),
      ...verifications.map((user) => ({
        id: `verification:${stringifyId(user)}`,
        date: user.expertVerification.submittedAt || user.createdAt,
        actionType: "mentor_verification_submitted",
        action: `${user.name} submitted mentor verification`,
        actor: user.name,
        actorEmail: user.email,
        targetType: "mentor",
        target: user.email,
        status: user.expertVerification.status,
      })),
      ...verifications
        .filter((user) => user.expertVerification.reviewedAt)
        .map((user) => ({
          id: `verification-review:${stringifyId(user)}`,
          date: user.expertVerification.reviewedAt || user.updatedAt,
          actionType: "mentor_verification_reviewed",
          action: `${user.name} verification was ${user.expertVerification.status}`,
          actor: "Admin",
          targetType: "mentor",
          target: user.email,
          status: user.expertVerification.status,
        })),
      ...reports.map((report) => ({
        id: `report:${stringifyId(report)}`,
        date: report.createdAt,
        actionType: "report_submitted",
        action: `Reported ${report.targetType}: ${report.reason}`,
        actor: userName(report.reporterId),
        actorEmail: userEmail(report.reporterId),
        targetType: report.targetType,
        target: String(report.targetId),
        status: report.status,
      })),
      ...threads.map((thread) => ({
        id: `thread:${stringifyId(thread)}`,
        date: thread.createdAt,
        actionType: "thread_created",
        action: `Created thread "${thread.title}" in ${thread.subject}`,
        actor: userName(thread.createdBy),
        actorEmail: userEmail(thread.createdBy),
        targetType: "thread",
        target: thread.title,
        status: thread.status,
      })),
      ...messages.map((message) => ({
        id: `message:${stringifyId(message)}`,
        date: message.createdAt,
        actionType: message.isFromAi ? "ai_message_created" : "message_sent",
        action: `${message.type} message: ${message.body.slice(0, 120)}`,
        actor: message.isFromAi ? "AI assistant" : userName(message.sender),
        actorEmail: message.isFromAi ? undefined : userEmail(message.sender),
        targetType: "message",
        target: stringifyId(message.thread),
        status: message.type,
      })),
    ];

    logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json({ logs: logs.slice(0, limit) });
  } catch (err) {
    next(err);
  }
});

export const adminRouter = router;
