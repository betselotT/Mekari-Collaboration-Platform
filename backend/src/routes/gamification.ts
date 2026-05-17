import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { IUser, User } from "../models/User";

const router = Router();

function buildLeaderboard(users: IUser[]) {
  return users.map((user, index) => ({
    _id: user.id,
    rank: index + 1,
    name: user.name,
    avatarUrl: user.avatarUrl,
    points: user.points,
    badges: user.badges,
    expertise: user.expertise,
    skillTags: user.skillTags,
    role: user.role,
    createdAt: user.createdAt,
  }));
}

router.get("/leaderboard", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const role = req.query.role === "expert" || req.query.role === "learner"
      ? req.query.role
      : undefined;
    const filter = role ? { role } : {};
    const users = await User.find(filter)
      .select("name avatarUrl points badges expertise skillTags role createdAt")
      .sort({ points: -1 })
      .limit(20);
    res.json({ leaderboard: buildLeaderboard(users) });
  } catch (err) {
    next(err);
  }
});

router.get("/leaderboards", requireAuth, async (_req: AuthRequest, res, next) => {
  try {
    const [learners, experts] = await Promise.all([
      User.find({ role: "learner" })
        .select("name avatarUrl points badges expertise skillTags role createdAt")
        .sort({ points: -1 })
        .limit(20),
      User.find({ role: "expert" })
        .select("name avatarUrl points badges expertise skillTags role createdAt")
        .sort({ points: -1 })
        .limit(20),
    ]);

    res.json({
      learners: buildLeaderboard(learners),
      experts: buildLeaderboard(experts),
    });
  } catch (err) {
    next(err);
  }
});

export const gamificationRouter = router;

