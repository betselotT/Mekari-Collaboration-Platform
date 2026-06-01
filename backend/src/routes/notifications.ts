import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { Notification } from "../models/Notification";
import { User } from "../models/User";

const router = Router();

const preferenceSchema = z.object({
  chat: z
    .object({ internal: z.boolean().optional(), push: z.boolean().optional(), email: z.boolean().optional() })
    .optional(),
  documentStatus: z
    .object({ internal: z.boolean().optional(), push: z.boolean().optional(), email: z.boolean().optional() })
    .optional(),
  moderation: z
    .object({ internal: z.boolean().optional(), push: z.boolean().optional(), email: z.boolean().optional() })
    .optional(),
  admin: z
    .object({ internal: z.boolean().optional(), push: z.boolean().optional(), email: z.boolean().optional() })
    .optional(),
});

const pushTokenSchema = z.object({
  token: z.string().min(20),
});

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

router.get("/preferences", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findById(req.userId).select("notificationPreferences");
    if (!user) return res.status(404).json({ error: { message: "User not found" } });
    res.json({ preferences: user.notificationPreferences });
  } catch (err) {
    next(err);
  }
});

router.put("/preferences", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = preferenceSchema.parse(req.body);
    const set: Record<string, boolean> = {};
    for (const [category, channels] of Object.entries(parsed)) {
      if (!channels) continue;
      if (channels.internal !== undefined) {
        set[`notificationPreferences.${category}.internal`] = channels.internal;
      }
      if (channels.push !== undefined) {
        set[`notificationPreferences.${category}.push`] = channels.push;
      }
      if (channels.email !== undefined) {
        set[`notificationPreferences.${category}.email`] = channels.email;
      }
    }

    const user = await User.findByIdAndUpdate(req.userId, { $set: set }, { new: true }).select(
      "notificationPreferences"
    );
    if (!user) return res.status(404).json({ error: { message: "User not found" } });
    res.json({ preferences: user.notificationPreferences });
  } catch (err) {
    next(err);
  }
});

router.post("/push-token", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = pushTokenSchema.parse(req.body);
    await User.updateOne(
      { _id: req.userId },
      { $pull: { pushTokens: { token: parsed.token } } }
    );
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        $push: {
          pushTokens: {
            token: parsed.token,
            provider: "fcm",
            platform: "web",
            createdAt: new Date(),
            lastUsedAt: new Date(),
          },
        },
      },
      { new: true }
    ).select("pushTokens");

    if (!user) return res.status(404).json({ error: { message: "User not found" } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/push-token", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = pushTokenSchema.parse(req.body);
    await User.updateOne({ _id: req.userId }, { $pull: { pushTokens: { token: parsed.token } } });
    res.json({ ok: true });
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
