import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { Report } from "../models/Report";
import { User } from "../models/User";
import { logAuditEvent } from "../services/auditLog";
import { broadcastAdminDashboardUpdate } from "../services/adminRealtime";
import { notifyAdmins } from "../services/notifications";

const router = Router();

const createReportSchema = z.object({
  targetType: z.enum(["thread", "message", "user"]),
  targetId: z.string().min(1),
  reason: z.string().min(5).max(1000),
});

router.post("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = createReportSchema.parse(req.body);
    if (!mongoose.Types.ObjectId.isValid(parsed.targetId)) {
      return res.status(400).json({ error: { message: "Invalid report target." } });
    }

    if (parsed.targetType === "user") {
      if (parsed.targetId === req.userId) {
        return res.status(400).json({ error: { message: "You cannot report yourself." } });
      }

      const targetUser = await User.findById(parsed.targetId).select("_id");
      if (!targetUser) {
        return res.status(404).json({ error: { message: "Reported user not found." } });
      }
    }

    const report = await Report.create({ reporterId: req.userId, ...parsed });
    const reporter = await User.findById(req.userId).select("name email");
    await logAuditEvent({
      actorId: req.userId,
      actorName: reporter?.name,
      actorEmail: reporter?.email,
      actionType: "report_submitted",
      action: `Reported ${parsed.targetType}: ${parsed.reason}`,
      targetType: parsed.targetType,
      targetId: parsed.targetId,
      status: report.status,
    });
    await notifyAdmins({
      type: "new_report",
      title: "New report",
      message: `${reporter?.name || "A user"} reported a ${parsed.targetType}: ${parsed.reason.slice(0, 120)}`,
      link: "/admin/reports",
    });
    await broadcastAdminDashboardUpdate({
      type: "report_created",
      id: String(report._id),
      message: `${reporter?.name || "A user"} submitted a new ${parsed.targetType} report.`,
    });
    res.status(201).json({ report });
  } catch (err) {
    next(err);
  }
});

export const reportRouter = router;
