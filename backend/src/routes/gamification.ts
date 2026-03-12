import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { User } from "../models/User";

const router = Router();

router.get("/leaderboard", requireAuth, async (_req: AuthRequest, res, next) => {
  try {
    const users = await User.find()
      .select("name avatarUrl points badges")
      .sort({ points: -1 })
      .limit(20);
    res.json({ leaderboard: users });
  } catch (err) {
    next(err);
  }
});

router.post("/reward", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId, points } = req.body as { userId: string; points: number };
    if (!userId || typeof points !== "number") {
      return res.status(400).json({ error: { message: "Invalid payload" } });
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $inc: { points } },
      { new: true }
    ).select("name points badges");

    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
});

export const gamificationRouter = router;

