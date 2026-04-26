import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { Thread } from "../models/Thread";
import { Message } from "../models/Message";
import { MatchRequest } from "../models/MatchRequest";
import { recommendExperts } from "../services/matching";

const router = Router();

const questionnaireSchema = z
  .object({
    primaryTechnicalField: z.string().min(1).optional(),
    roleOrStatus: z.string().min(1).optional(),
    yearsOfExperience: z.string().min(1).optional(),
    devicesUsed: z.array(z.string().min(1)).optional(),
    helpFrequency: z.string().min(1).optional(),
    currentPlatformsUsed: z.array(z.string().min(1)).optional(),
    biggestChallenges: z.array(z.string().min(1)).optional(),
    connectionPreferences: z.array(z.enum(["chat", "voice_video", "group_channel"])).optional(),
    gamificationIncentives: z.array(z.string().min(1)).optional(),
    usageVision: z.string().min(1).optional(),
    accessibilityNeeds: z.array(z.string().min(1)).optional(),
    crossDeviceImportance: z.number().int().min(1).max(5).optional(),
    excitement: z.string().min(1).optional(),
    safetyConcerns: z.string().min(1).optional(),
    contact: z
      .object({
        email: z.string().email().optional(),
        telegramUsername: z.string().min(1).optional(),
        phoneNumber: z.string().min(1).optional(),
      })
      .optional(),
  })
  .strict();

const createMatchRequestSchema = z.object({
  title: z.string().min(5),
  subject: z.string().min(1),
  initialMessage: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  availabilityPreference: z
    .enum(["online_only", "online_or_busy", "any"])
    .default("online_or_busy"),
  questionnaire: questionnaireSchema.optional(),
});

router.post("/request", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = createMatchRequestSchema.parse(req.body);

    const thread = await Thread.create({
      title: parsed.title,
      subject: parsed.subject,
      createdBy: req.userId,
      participants: [req.userId],
    });

    await Message.create({
      thread: thread.id,
      sender: req.userId,
      body: parsed.initialMessage,
      isFromAi: false,
    });

    const recommendations = await recommendExperts({
      requesterId: req.userId,
      subject: parsed.subject,
      tags: parsed.tags,
      availabilityPreference: parsed.availabilityPreference,
      limit: 5,
    });

    const matchRequest = await MatchRequest.create({
      requester: req.userId,
      thread: thread.id,
      subject: parsed.subject,
      tags: parsed.tags,
      availabilityPreference: parsed.availabilityPreference,
      questionnaire: parsed.questionnaire,
      status: recommendations.length > 0 ? "matched" : "open",
      recommendations: recommendations.map((r) => ({
        expert: r.expertId,
        score: r.score,
        reasons: r.reasons,
      })),
    });

    // Optionally, auto-notify via socket in a later iteration.
    const populated = await MatchRequest.findById(matchRequest.id)
      .populate("recommendations.expert", "name avatarUrl expertise availabilityStatus points badges")
      .lean();

    res.status(201).json({
      thread,
      matchRequest: populated,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/requests/:matchRequestId", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { matchRequestId } = req.params;
    const doc = await MatchRequest.findById(matchRequestId)
      .populate("thread")
      .populate("recommendations.expert", "name avatarUrl expertise availabilityStatus points badges");

    if (!doc) {
      return res.status(404).json({ error: { message: "Match request not found" } });
    }

    if (String(doc.requester) !== String(req.userId) && req.userRole !== "admin") {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }

    res.json({ matchRequest: doc });
  } catch (err) {
    next(err);
  }
});

export const matchingRouter = router;

