import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { Thread } from "../models/Thread";
import { Message } from "../models/Message";
import { MatchRequest } from "../models/MatchRequest";
import { User } from "../models/User";
import { POINT_VALUES } from "../services/awardPoints";
import { recommendExperts } from "../services/matching";
import { generateContentTags } from "../services/tagExtraction";

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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTopicRegex(subject?: string, tags: string[] = []) {
  const terms = [subject, ...tags].map((term) => term?.trim()).filter(Boolean) as string[];
  if (terms.length === 0) return undefined;
  return new RegExp(terms.map(escapeRegex).join("|"), "i");
}

async function findPreviewExperts(subject?: string, tags: string[] = []) {
  const topicRegex = buildTopicRegex(subject, tags);
  const topicFilter = topicRegex
    ? {
        $or: [
          { "expertise.subject": topicRegex },
          { skillTags: topicRegex },
          { bio: topicRegex },
        ],
      }
    : {};

  return User.find({
    role: "expert",
    "expertVerification.status": "approved",
    isBanned: { $ne: true },
    ...topicFilter,
  })
    .select("name expertise availabilityStatus points")
    .sort({ availabilityStatus: 1, points: -1 })
    .limit(2)
    .lean();
}

router.get("/public/landing-preview", async (_req, res, next) => {
  try {
    const latestMatchRequest = await MatchRequest.findOne({})
      .sort({ updatedAt: -1, createdAt: -1 })
      .populate("thread", "title subject tags googleMeetLink")
      .populate("recommendations.expert", "name expertise availabilityStatus points")
      .lean();

    const matchedThread = latestMatchRequest?.thread as
      | { title?: string; subject?: string; tags?: string[]; googleMeetLink?: string }
      | undefined;

    const fallbackThread = matchedThread
      ? null
      : await Thread.findOne({})
          .sort({ updatedAt: -1, createdAt: -1 })
          .populate("matchedExperts", "name expertise availabilityStatus points")
          .select("title subject tags googleMeetLink matchedExperts")
          .lean();

    const sourceThread = matchedThread || fallbackThread;
    const tags = latestMatchRequest?.tags?.length
      ? latestMatchRequest.tags
      : sourceThread?.tags || [];
    const subject = latestMatchRequest?.subject || sourceThread?.subject || "";

    const recommendedExperts =
      latestMatchRequest?.recommendations
        ?.map((recommendation) => recommendation.expert)
        .filter(Boolean)
        .slice(0, 2) || [];
    const threadExperts =
      !recommendedExperts.length && fallbackThread?.matchedExperts
        ? fallbackThread.matchedExperts.slice(0, 2)
        : [];
    const topicExperts =
      recommendedExperts.length || threadExperts.length
        ? []
        : await findPreviewExperts(subject, tags);

    const [activeMatchRequests, approvedExperts] = await Promise.all([
      MatchRequest.countDocuments({ status: { $in: ["open", "matched"] } }),
      User.countDocuments({
        role: "expert",
        "expertVerification.status": "approved",
        isBanned: { $ne: true },
      }),
    ]);

    const helpers = [...recommendedExperts, ...threadExperts, ...topicExperts]
      .slice(0, 2)
      .map((expert: any) => ({
        name: expert.name,
        expertise: expert.expertise?.[0]?.subject || "Mentor",
        availabilityStatus: expert.availabilityStatus,
        points: expert.points || 0,
      }));

    res.json({
      preview: {
        threadTitle: sourceThread?.title || "",
        subject,
        tags,
        helpers,
        hasLiveSession: Boolean(sourceThread?.googleMeetLink),
        connectionPreferences:
          latestMatchRequest?.questionnaire?.connectionPreferences || [],
        stats: {
          activeMatchRequests,
          approvedExperts,
          solutionPoints: POINT_VALUES.ANSWER_MARKED_SOLUTION,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/request", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = createMatchRequestSchema.parse(req.body);
    const tags = await generateContentTags({
      title: parsed.title,
      subject: parsed.subject,
      body: parsed.initialMessage,
      existingTags: parsed.tags,
    });

    const thread = await Thread.create({
      title: parsed.title,
      subject: parsed.subject,
      body: parsed.initialMessage,
      tags,
      createdBy: req.userId,
      participants: [req.userId],
    });

    await Message.create({
      thread: thread.id,
      sender: req.userId,
      body: parsed.initialMessage,
      readBy: [{ user: req.userId, readAt: new Date() }],
      isPinned: true,
      isFromAi: false,
    });

    const recommendations = await recommendExperts({
      requesterId: req.userId,
      subject: parsed.subject,
      tags,
      title: parsed.title,
      body: parsed.initialMessage,
      availabilityPreference: parsed.availabilityPreference,
      limit: 5,
    });

    const matchRequest = await MatchRequest.create({
      requester: req.userId,
      thread: thread.id,
      subject: parsed.subject,
      tags,
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
      .populate("recommendations.expert", "name avatarUrl expertise availabilityStatus points")
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
      .populate("recommendations.expert", "name avatarUrl expertise availabilityStatus points");

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
