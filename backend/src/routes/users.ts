import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { User } from "../models/User";

const router = Router();

const profileUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
  expertise: z
    .array(
      z.object({
        subject: z.string().min(1),
        proficiency: z.enum(["beginner", "intermediate", "advanced", "expert"]),
      })
    )
    .optional(),
  skillTags: z.array(z.string().min(1)).optional(),
  availabilityStatus: z.enum(["online", "busy", "offline", "in_session"]).optional(),
});

router.get("/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash").lean();
    if (!user) return res.status(404).json({ error: { message: "User not found" } });

    // Calculate global rank (count users with more points + 1)
    const rank = await User.countDocuments({ points: { $gt: user.points || 0 } }) + 1;

    res.json({ user: { ...user, rank } });
  } catch (err) {
    next(err);
  }
});

router.put("/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = profileUpdateSchema.parse(req.body);
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: parsed },
      { new: true }
    ).select("-passwordHash");
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.get("/experts", requireAuth, async (_req: AuthRequest, res, next) => {
  try {
    const experts = await User.find({ "expertise.0": { $exists: true } })
      .select("name avatarUrl expertise skillTags availabilityStatus points badges")
      .sort({ points: -1 });
    res.json({ experts });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id — public profile
router.get("/:id", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash");
    if (!user) return res.status(404).json({ error: { message: "User not found" } });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id — update own profile (admin can update anyone)
router.patch("/:id", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (req.params.id !== req.userId && req.userRole !== "admin") {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }
    const parsed = profileUpdateSchema.parse(req.body);
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: parsed },
      { new: true }
    ).select("-passwordHash");
    if (!user) return res.status(404).json({ error: { message: "User not found" } });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id/availability — update availability (own only or admin)
router.patch("/:id/availability", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (req.params.id !== req.userId && req.userRole !== "admin") {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }
    const { status } = req.body as { status: string };
    const valid = ["online", "busy", "offline", "in_session"];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: { message: "Invalid status" } });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { availabilityStatus: status } },
      { new: true }
    ).select("-passwordHash");
    if (!user) return res.status(404).json({ error: { message: "User not found" } });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export const userRouter = router;

