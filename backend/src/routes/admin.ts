import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { Report } from "../models/Report";
import { Thread } from "../models/Thread";
import { Message } from "../models/Message";
import { User } from "../models/User";

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
  status: z.enum(["pending", "resolved", "dismissed"]),
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
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { $set: { status: parsed.status } },
      { new: true }
    );
    if (!report) return res.status(404).json({ error: { message: "Report not found" } });
    res.json({ report });
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

export const adminRouter = router;
