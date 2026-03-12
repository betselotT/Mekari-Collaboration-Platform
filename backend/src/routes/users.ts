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
  availabilityStatus: z.enum(["online", "busy", "offline"]).optional(),
});

router.get("/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash");
    res.json({ user });
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
      .select("name avatarUrl expertise availabilityStatus points badges")
      .sort({ points: -1 });
    res.json({ experts });
  } catch (err) {
    next(err);
  }
});

export const userRouter = router;

