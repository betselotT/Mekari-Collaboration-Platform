import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { Notification } from "../models/Notification";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
});

// /read-all must be defined before /:id to prevent it matching as an id
router.patch("/read-all", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await Notification.updateMany({ userId: req.userId, read: false }, { $set: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { read: true } },
      { new: true }
    );
    if (!notif) return res.status(404).json({ error: { message: "Notification not found" } });
    res.json({ notification: notif });
  } catch (err) {
    next(err);
  }
});

export const notificationRouter = router;
