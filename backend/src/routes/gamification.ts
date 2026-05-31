import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { IUser, User } from "../models/User";
import { withAchievementSummaries } from "../services/awardPoints";

const router = Router();

async function buildLeaderboard(users: IUser[]) {
  const hydratedUsers = await withAchievementSummaries(users.map((user) => user.toObject()));
  return hydratedUsers.map((user, index) => ({
    _id: user._id,
    rank: index + 1,
    name: user.name,
    avatarUrl: user.avatarUrl,
    points: user.points,
    badges: user.badges,
    badgeCounts: user.badgeCounts,
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
    const filter = role ? { role, isBanned: { $ne: true } } : { isBanned: { $ne: true } };
    const users = await User.find(filter)
      .select("name avatarUrl points expertise skillTags role createdAt")
      .sort({ points: -1 })
      .limit(20);
    res.json({ leaderboard: await buildLeaderboard(users) });
  } catch (err) {
    next(err);
  }
});

router.get("/leaderboards", requireAuth, async (_req: AuthRequest, res, next) => {
  try {
    const [learners, experts] = await Promise.all([
      User.find({ role: "learner", isBanned: { $ne: true } })
        .select("name avatarUrl points expertise skillTags role createdAt")
        .sort({ points: -1 })
        .limit(20),
      User.find({ role: "expert", isBanned: { $ne: true } })
        .select("name avatarUrl points expertise skillTags role createdAt")
        .sort({ points: -1 })
        .limit(20),
    ]);

    res.json({
      learners: await buildLeaderboard(learners),
      experts: await buildLeaderboard(experts),
    });
  } catch (err) {
    next(err);
  }
});

export const gamificationRouter = router;

