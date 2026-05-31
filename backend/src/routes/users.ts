import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { ExpertReview } from "../models/ExpertReview";
import { logAuditEvent } from "../services/auditLog";
import { withAchievementSummaries, withAchievementSummary } from "../services/awardPoints";
import { notifyAdmins } from "../services/notifications";

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

const reviewCreateSchema = z.object({
  stars: z
    .number()
    .min(1)
    .max(5)
    .refine((value) => Number.isInteger(value * 2), {
      message: "Stars must use 0.5 increments.",
    }),
  comment: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => (value ? value : undefined)),
});

type ReviewStatsInput = { stars: number }[];

function buildReviewStats(reviews: ReviewStatsInput = []) {
  const expertReviewCount = reviews.length;
  const expertRatingAverage =
    expertReviewCount === 0
      ? undefined
      : Number(
          (
            reviews.reduce((sum, review) => sum + review.stars, 0) /
            expertReviewCount
          ).toFixed(1)
        );

  return { expertRatingAverage, expertReviewCount };
}

type ReviewStats = ReturnType<typeof buildReviewStats>;

type ReviewStatsAggregate = {
  _id: unknown;
  expertRatingAverage: number;
  expertReviewCount: number;
};

function buildReviewStatsFromAggregate(
  stats?: Pick<ReviewStatsAggregate, "expertRatingAverage" | "expertReviewCount">
): ReviewStats {
  if (!stats || stats.expertReviewCount === 0) {
    return { expertRatingAverage: undefined, expertReviewCount: 0 };
  }

  return {
    expertRatingAverage: Number(stats.expertRatingAverage.toFixed(1)),
    expertReviewCount: stats.expertReviewCount,
  };
}

async function getReviewStatsForExpert(expertId: string) {
  const [stats] = await ExpertReview.aggregate<ReviewStatsAggregate>([
    { $match: { expert: new Types.ObjectId(expertId) } },
    {
      $group: {
        _id: "$expert",
        expertRatingAverage: { $avg: "$rating" },
        expertReviewCount: { $sum: 1 },
      },
    },
  ]);

  return buildReviewStatsFromAggregate(stats);
}

router.get("/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash").lean();
    if (!user) return res.status(404).json({ error: { message: "User not found" } });

    // Calculate global rank (count users with more points + 1)
    const rank = await User.countDocuments({ points: { $gt: user.points || 0 } }) + 1;

    res.json({ user: { ...(await withAchievementSummary(user)), rank } });
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
    res.json({
      user: user ? await withAchievementSummary(user.toObject()) : user,
    });
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
      if (isMentor) {
        await notifyAdmins({
          type: "mentor_verification_submitted",
          title: "New mentor approval request",
          message: `${user.name} asked to be approved as a mentor.`,
          link: "/admin/mentor-verifications",
        });
      }
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.post("/me/mentor-verification-document", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = z.object({
      verificationDocument: verificationDocumentSchema,
    }).parse(req.body);

    const user = await User.findOneAndUpdate(
      { _id: req.userId, role: "expert" },
      {
        $set: {
          "expertVerification.status": "pending",
          "expertVerification.document": {
            ...parsed.verificationDocument,
            uploadedAt: new Date(),
          },
          "expertVerification.submittedAt": new Date(),
        },
        $unset: {
          "expertVerification.reviewNote": "",
          "expertVerification.reviewedAt": "",
          "expertVerification.reviewedBy": "",
        },
      },
      { new: true }
    ).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ error: { message: "Mentor profile not found." } });
    }

    await logAuditEvent({
      actorId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      actionType: "mentor_verification_resubmitted",
      action: `${user.name} uploaded a new mentor verification document`,
      targetType: "mentor",
      targetId: user.id,
      status: "pending",
    });
    await notifyAdmins({
      type: "mentor_verification_submitted",
      title: "Mentor document resubmitted",
      message: `${user.name} uploaded a new mentor verification document.`,
      link: "/admin/mentor-verifications",
    });

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.get("/experts", requireAuth, async (_req: AuthRequest, res, next) => {
  try {
    const experts = await User.find({
      role: "expert",
      "expertVerification.status": "approved",
      isBanned: { $ne: true },
    })
      .select("name avatarUrl bio expertise skillTags availabilityStatus points role expertVerification")
      .sort({ points: -1 })
      .lean();

    const expertIds = experts.map((expert) => expert._id);
    const reviewStats = await ExpertReview.aggregate<ReviewStatsAggregate>([
      { $match: { expert: { $in: expertIds } } },
      {
        $group: {
          _id: "$expert",
          expertRatingAverage: { $avg: "$rating" },
          expertReviewCount: { $sum: 1 },
        },
      },
    ]);
    const statsByExpertId = new Map(
      reviewStats.map((stats) => [
        String(stats._id),
        buildReviewStatsFromAggregate(stats),
      ])
    );

    res.json({
      experts: (await withAchievementSummaries(experts)).map((expert) => ({
        ...expert,
        ...(statsByExpertId.get(String(expert._id)) || buildReviewStatsFromAggregate()),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/directory", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const role = z.enum(["user", "mentor"]).parse(req.query.role);
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(10, Math.max(1, Number(req.query.limit || 10)));
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {
      role: role === "mentor" ? "expert" : { $in: ["learner", "user"] },
      _id: { $ne: req.userId },
      isBanned: { $ne: true },
    };

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { primaryTechnicalField: { $regex: q, $options: "i" } },
        { skillTags: { $regex: q, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("name email avatarUrl role bio primaryTechnicalField roleOrStatus yearsOfExperience expertise skillTags availabilityStatus points")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:expertId/reviews", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = reviewCreateSchema.parse(req.body);

    if (req.params.expertId === req.userId) {
      return res.status(400).json({ error: { message: "Experts cannot review themselves." } });
    }

    const expert = await User.findOne({ _id: req.params.expertId, role: "expert", isBanned: { $ne: true } }).select("_id");

    if (!expert) {
      return res.status(404).json({ error: { message: "Expert not found." } });
    }

    await ExpertReview.create({
      expert: expert._id,
      reviewer: req.userId,
      rating: parsed.stars,
      comment: parsed.comment,
    });

    res.status(201).json(await getReviewStatsForExpert(req.params.expertId));
  } catch (err) {
    next(err);
  }
});

router.get("/:expertId/reviews", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const expert = await User.findOne({ _id: req.params.expertId, role: "expert", isBanned: { $ne: true } })
      .select("_id")
      .lean();

    if (!expert) {
      return res.status(404).json({ error: { message: "Expert not found." } });
    }

    const reviews = await ExpertReview.find({ expert: req.params.expertId })
      .select("reviewer rating comment createdAt")
      .populate("reviewer", "name avatarUrl")
      .sort({ createdAt: -1 })
      .lean();
    const serializedReviews = reviews.map((review) => ({
      _id: review._id,
      by: review.reviewer,
      stars: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
    }));

    res.json({
      reviews: serializedReviews,
      ...buildReviewStats(serializedReviews),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id — public profile
router.get("/:id", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select("name avatarUrl role bio primaryTechnicalField roleOrStatus yearsOfExperience expertise skillTags availabilityStatus points")
      .lean();
    if (!user) return res.status(404).json({ error: { message: "User not found" } });

    const reviewStats =
      user.role === "expert"
        ? await getReviewStatsForExpert(req.params.id)
        : buildReviewStatsFromAggregate();

    res.json({
      user: {
        ...(await withAchievementSummary(user)),
        ...reviewStats,
      },
    });
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

