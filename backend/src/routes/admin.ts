import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { Report } from "../models/Report";
import { Thread } from "../models/Thread";
import { Message } from "../models/Message";
import { User } from "../models/User";
import { createNotification } from "../services/notifications";

const router = Router();

function requireMod(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== "admin" && req.userRole !== "mod") {
    return res.status(403).json({ error: { message: "Moderator access required" } });
  }
  next();
}

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== "admin") {
    return res.status(403).json({ error: { message: "Admin access required" } });
  }
  next();
}

const updateReportSchema = z.object({
  status: z.enum(["pending", "resolved", "struck", "dismissed"]),
  actionTaken: z.string().max(500).optional(),
  banReason: z.string().trim().min(1).max(500).optional(),
});

const reviewVerificationSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNote: z.string().max(500).optional(),
});

router.get("/reports", requireAuth, requireMod, async (_req, res, next) => {
  try {
    const reports = await Report.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("reporterId", "name email");
    res.json({ reports });
  } catch (err) {
    next(err);
  }
});

router.patch("/reports/:id", requireAuth, requireMod, async (req: AuthRequest, res, next) => {
  try {
    const parsed = updateReportSchema.parse(req.body);
    const existingReport = await Report.findById(req.params.id);
    if (!existingReport) return res.status(404).json({ error: { message: "Report not found" } });

    let strikeCount: number | undefined;
    let shouldBan = false;
    let targetUser = null;
    if (parsed.status === "struck" && existingReport.targetType === "user") {
      const priorStrikes = await Report.countDocuments({
        _id: { $ne: existingReport._id },
        targetType: "user",
        targetId: existingReport.targetId,
        status: { $in: ["struck", "resolved"] },
      });
      strikeCount = priorStrikes + 1;
      targetUser = await User.findById(existingReport.targetId);
      shouldBan = strikeCount >= 3 && !targetUser?.isBanned;
      if (shouldBan && !parsed.banReason) {
        return res.status(400).json({ error: { message: "Ban reason is required when issuing the third strike." } });
      }
    }

    const update: { status: string; actionTaken?: string } = { status: parsed.status };
    if (parsed.actionTaken !== undefined) update.actionTaken = parsed.actionTaken;

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );
    if (!report) return res.status(404).json({ error: { message: "Report not found" } });

    if (parsed.status === "struck" && report.targetType === "user") {
      if (shouldBan && targetUser) {
        const reason = parsed.banReason as string;
        targetUser.isBanned = true;
        targetUser.bannedAt = new Date();
        targetUser.banReason = reason;
        targetUser.availabilityStatus = "offline";
        await targetUser.save();
        await createNotification({
          userId: String(report.targetId),
          category: "moderation",
          type: "account_banned",
          title: "Account banned",
          message: `Your account has been banned: ${reason}`,
          link: "/login",
        });
      } else {
        await createNotification({
          userId: String(report.targetId),
          category: "moderation",
          type: "account_strike",
          title: "Account strike",
          message: `Your account has been struck for a community violation. Total strikes: ${strikeCount}.`,
          link: "/dashboard/profile",
        });
      }
    }

    res.json({ report, strikeCount, banned: shouldBan || Boolean(targetUser?.isBanned), banReason: targetUser?.banReason });
  } catch (err) {
    next(err);
  }
});

router.get("/analytics", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const [userCount, threadCount, messageCount, solvedCount, openCount, pendingCount, aiResolvedCount] =
      await Promise.all([
        User.countDocuments(),
        Thread.countDocuments(),
        Message.countDocuments(),
        Thread.countDocuments({ status: "SOLVED" }),
        Thread.countDocuments({ status: "OPEN" }),
        Thread.countDocuments({ status: "PENDING_EXPERT" }),
        Thread.countDocuments({ status: "AI_RESOLVED" }),
      ]);

    res.json({
      metrics: {
        userCount,
        threadCount,
        messageCount,
        solvedCount,
        openCount,
        pendingCount,
        aiResolvedCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/expert-verifications", requireAuth, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const status = z
      .enum(["pending", "approved", "rejected"])
      .optional()
      .parse(req.query.status);
    const filter = status
      ? { role: "expert", "expertVerification.status": status }
      : { role: "expert", "expertVerification.status": { $in: ["pending", "approved", "rejected"] } };

    const users = await User.find(filter)
      .select("name email primaryTechnicalField roleOrStatus yearsOfExperience expertise skillTags expertVerification createdAt")
      .sort({ "expertVerification.submittedAt": -1, createdAt: -1 });

    res.json({ verifications: users });
  } catch (err) {
    next(err);
  }
});

router.patch("/expert-verifications/:userId", requireAuth, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const parsed = reviewVerificationSchema.parse(req.body);
    const user = await User.findOneAndUpdate(
      { _id: req.params.userId, role: "expert" },
      {
        $set: {
          "expertVerification.status": parsed.status,
          "expertVerification.reviewNote": parsed.reviewNote,
          "expertVerification.reviewedAt": new Date(),
          "expertVerification.reviewedBy": req.userId,
        },
      },
      { new: true }
    ).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ error: { message: "Mentor verification request not found" } });
    }

    await createNotification({
      userId: String(user._id),
      category: "documentStatus",
      type: "mentor_verification_reviewed",
      title: "Mentor verification reviewed",
      message:
        parsed.status === "approved"
          ? "Your mentor verification document was approved."
          : `Your mentor verification document was rejected${parsed.reviewNote ? `: ${parsed.reviewNote}` : "."}`,
      link: "/dashboard/profile",
    });

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export const adminRouter = router;
