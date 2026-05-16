import { Router } from "express";
import { z } from "zod";
import { adminUsername } from "../auth";
import { AuditLog } from "../models/AuditLog";
import { Message } from "../models/Message";
import { Notification } from "../models/Notification";
import { Report } from "../models/Report";
import { Thread } from "../models/Thread";
import { User } from "../models/User";

const router = Router();

const verificationStatusSchema = z.enum(["pending", "approved", "rejected"]);
const reportStatusSchema = z.enum(["pending", "resolved", "struck", "dismissed"]);

const reviewVerificationSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNote: z.string().max(500).optional(),
}).refine((value) => value.status === "approved" || Boolean(value.reviewNote?.trim()), {
  message: "Rejection reason is required",
  path: ["reviewNote"],
});

const reviewReportSchema = z.object({
  status: z.enum(["struck", "dismissed", "pending"]),
  actionTaken: z.string().max(500).optional(),
});

const pushTokenSchema = z.object({
  token: z.string().min(20),
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

async function findAdminPushUser() {
  const configuredEmail =
    process.env.ADMIN_PUSH_USER_EMAIL || process.env.ADMIN_EMAIL || adminUsername();

  if (configuredEmail.includes("@")) {
    const configuredUser = await User.findOneAndUpdate(
      { email: configuredEmail },
      {
        $set: { role: "admin" },
        $setOnInsert: {
          name: process.env.ADMIN_PUSH_USER_NAME || "Mekari Admin",
          email: configuredEmail,
          availabilityStatus: "offline",
          devicesUsed: [],
          expertise: [],
          skillTags: [],
          expertVerification: { status: "not_required" },
          points: 0,
        },
      },
      { new: true, upsert: true }
    ).select("_id name email");
    if (configuredUser) return configuredUser;
  }

  return User.findOne({ role: { $in: ["admin", "mod"] } })
    .sort({ role: 1, createdAt: 1 })
    .select("_id name email");
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

router.get("/notifications", async (_req, res, next) => {
  try {
    const notifications = await Notification.find({
      type: { $in: ["new_report", "mentor_verification_submitted"] },
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
});

router.post("/push-token", async (req, res, next) => {
  try {
    const parsed = pushTokenSchema.parse(req.body);
    const adminUser = await findAdminPushUser();
    if (!adminUser) {
      res.status(404).json({
        error: {
          message:
            "No admin or moderator user exists in the shared database. Create one or set ADMIN_PUSH_USER_EMAIL to an admin user's email.",
        },
      });
      return;
    }

    await User.updateOne(
      { _id: adminUser._id },
      { $pull: { pushTokens: { token: parsed.token } } }
    );
    await User.updateOne(
      { _id: adminUser._id },
      {
        $push: {
          pushTokens: {
            token: parsed.token,
            provider: "fcm",
            platform: "admin_web",
            createdAt: new Date(),
            lastUsedAt: new Date(),
          },
        },
        $set: {
          "notificationPreferences.admin.internal": true,
          "notificationPreferences.admin.push": true,
        },
      }
    );

    res.json({
      ok: true,
      user: {
        id: String(adminUser._id),
        name: adminUser.name,
        email: adminUser.email,
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
      .select("name email bio primaryTechnicalField roleOrStatus yearsOfExperience devicesUsed collaborationGoals availabilityStatus expertise skillTags expertVerification.status expertVerification.reviewNote expertVerification.submittedAt expertVerification.reviewedAt expertVerification.document.fileName expertVerification.document.fileType expertVerification.document.fileSize expertVerification.document.uploadedAt points createdAt")
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

router.get("/mentor-verifications/:userId/document", async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, role: "expert" })
      .select("name expertVerification.document")
      .exec();
    const document = user?.expertVerification?.document;

    if (!document?.dataUrl) {
      res.status(404).json({ error: { message: "Verification document not found" } });
      return;
    }

    const match = document.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      res.status(422).json({ error: { message: "Verification document is not readable" } });
      return;
    }

    const [, contentType, payload] = match;
    const fileBuffer = Buffer.from(payload, "base64");
    const safeFileName = document.fileName.replace(/[^\w.\- ]+/g, "_");

    res.setHeader("Content-Type", contentType || document.fileType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${safeFileName}"`);
    res.send(fileBuffer);
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

    await Notification.create({
      userId: user._id,
      type: "mentor_verification_reviewed",
      message:
        parsed.status === "approved"
          ? "Your mentor verification document was approved."
          : `Your mentor verification document was rejected${parsed.reviewNote ? `: ${parsed.reviewNote}` : "."}`,
      link: "/dashboard/profile",
      read: false,
    });

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.get("/reported-users", async (_req, res, next) => {
  try {
    const rows = await Report.aggregate([
      { $match: { targetType: "user" } },
      {
        $group: {
          _id: "$targetId",
          reportCount: { $sum: 1 },
          pendingCount: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          strikeCount: { $sum: { $cond: [{ $in: ["$status", ["struck", "resolved"]] }, 1, 0] } },
          dismissedCount: { $sum: { $cond: [{ $eq: ["$status", "dismissed"] }, 1, 0] } },
          latestReportAt: { $max: "$createdAt" },
        },
      },
      { $sort: { reportCount: -1, latestReportAt: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          reportCount: 1,
          pendingCount: 1,
          strikeCount: 1,
          dismissedCount: 1,
          latestReportAt: 1,
          user: {
            _id: "$user._id",
            name: "$user.name",
            email: "$user.email",
            role: "$user.role",
            primaryTechnicalField: "$user.primaryTechnicalField",
            roleOrStatus: "$user.roleOrStatus",
            yearsOfExperience: "$user.yearsOfExperience",
            points: "$user.points",
          },
        },
      },
    ]);

    res.json({ reportedUsers: rows });
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
      .populate("reporterId", "name email role primaryTechnicalField roleOrStatus yearsOfExperience devicesUsed bio expertise skillTags points createdAt")
        .lean(),
      Report.countDocuments(filter),
    ]);

    const targetIds = {
      user: reports.filter((r) => r.targetType === "user").map((r) => r.targetId),
      thread: reports.filter((r) => r.targetType === "thread").map((r) => r.targetId),
      message: reports.filter((r) => r.targetType === "message").map((r) => r.targetId),
    };

    const [users, threads, messages] = await Promise.all([
      User.find({ _id: { $in: targetIds.user } })
        .select("name email role primaryTechnicalField roleOrStatus yearsOfExperience devicesUsed bio expertise skillTags points createdAt")
        .lean(),
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
    const update: { status: string; actionTaken?: string } = { status: parsed.status };
    if (parsed.actionTaken !== undefined) update.actionTaken = parsed.actionTaken;

    const report = await Report.findByIdAndUpdate(
      req.params.reportId,
      { $set: update },
      { new: true }
    );

    if (!report) {
      res.status(404).json({ error: { message: "Report not found" } });
      return;
    }

    await AuditLog.create({
      actorName: "Admin",
      actionType: "report_reviewed",
      action: parsed.actionTaken
        ? `Report ${report.id} marked ${parsed.status}: ${parsed.actionTaken}`
        : `Report ${report.id} marked ${parsed.status}`,
      targetType: "report",
      targetId: report.id,
      status: parsed.status,
    });

    if (parsed.status === "struck" && report.targetType === "user") {
      const strikeCount = await Report.countDocuments({
        targetType: "user",
        targetId: report.targetId,
        status: "struck",
      });
      await Notification.create({
        userId: report.targetId,
        type: "account_strike",
        message: `Your account has been struck for a community violation. Total strikes: ${strikeCount}.`,
        link: "/dashboard/profile",
        read: false,
      });
    }

    res.json({ report });
  } catch (err) {
    next(err);
  }
});

router.get("/action-logs", async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const actionType = typeof req.query.actionType === "string" ? req.query.actionType.trim() : "";
    const filter = actionType ? { actionType } : {};

    const [auditLogs, total, actionTypes] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
      AuditLog.distinct("actionType"),
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
      actionTypes: actionTypes.filter(Boolean).sort(),
      pagination: pagination(page, limit, total),
    });
  } catch (err) {
    next(err);
  }
});

export const adminRouter = router;
