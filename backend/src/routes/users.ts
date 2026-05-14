import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { logAuditEvent } from "../services/auditLog";

const router = Router();

const profileUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
  primaryTechnicalField: z.string().min(1).optional(),
  roleOrStatus: z.string().min(1).optional(),
  yearsOfExperience: z.string().min(1).optional(),
  devicesUsed: z.array(z.string().min(1)).optional(),
  collaborationGoals: z.string().max(500).optional(),
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

const verificationDocumentSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().int().positive().max(5 * 1024 * 1024),
  dataUrl: z.string().startsWith("data:").max(7_000_000),
});

const profileSetupSchema = z.object({
  accountType: z.enum(["learner", "mentor"]),
  primaryTechnicalField: z.string().min(1),
  roleOrStatus: z.string().min(1),
  yearsOfExperience: z.string().min(1),
  devicesUsed: z.array(z.string().min(1)).min(1),
  collaborationGoals: z.string().max(500).optional(),
  expertise: z
    .array(
      z.object({
        subject: z.string().min(1),
        proficiency: z.enum(["beginner", "intermediate", "advanced", "expert"]),
      })
    )
    .default([]),
  skillTags: z.array(z.string().min(1)).default([]),
  availabilityStatus: z.enum(["online", "busy", "offline", "in_session"]).default("offline"),
  verificationDocument: verificationDocumentSchema.optional(),
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

router.post("/me/setup", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = profileSetupSchema.parse(req.body);
    const isMentor = parsed.accountType === "mentor";

    if (isMentor && parsed.expertise.length === 0) {
      return res
        .status(400)
        .json({ error: { message: "Mentors must add at least one expertise area" } });
    }

    if (isMentor && !parsed.verificationDocument) {
      return res
        .status(400)
        .json({ error: { message: "Mentors must upload a verification document" } });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        $set: {
          role: isMentor ? "expert" : "learner",
          primaryTechnicalField: parsed.primaryTechnicalField,
          roleOrStatus: parsed.roleOrStatus,
          yearsOfExperience: parsed.yearsOfExperience,
          devicesUsed: parsed.devicesUsed,
          collaborationGoals: parsed.collaborationGoals,
          expertise: isMentor ? parsed.expertise : [],
          skillTags: isMentor ? parsed.skillTags : [],
          availabilityStatus: isMentor ? parsed.availabilityStatus : "offline",
          expertVerification: isMentor
            ? {
                status: "pending",
                document: {
                  ...parsed.verificationDocument,
                  uploadedAt: new Date(),
                },
                submittedAt: new Date(),
              }
            : { status: "not_required" },
          profileSetupCompleted: true,
        },
      },
      { new: true }
    ).select("-passwordHash");

    if (user) {
      await logAuditEvent({
        actorId: user.id,
        actorName: user.name,
        actorEmail: user.email,
        actionType: isMentor ? "mentor_verification_submitted" : "profile_setup_completed",
        action: isMentor
          ? `${user.name} submitted mentor verification`
          : `${user.name} completed learner profile setup`,
        targetType: isMentor ? "mentor" : "user",
        targetId: user.id,
        status: isMentor ? "pending" : "completed",
      });
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.get("/experts", requireAuth, async (_req: AuthRequest, res, next) => {
  try {
    const experts = await User.find({
      role: "expert",
    })
      .select("name avatarUrl bio expertise skillTags availabilityStatus points badges role expertVerification")
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

