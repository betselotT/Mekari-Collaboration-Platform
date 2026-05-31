import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { Message } from "../models/Message";
import { User } from "../models/User";
import * as intelligence from "../intelligence/client";
import { askGemini } from "../services/gemini";

const router = Router();

const chatSchema = z.object({
  threadId: z.string().min(1).optional(),
  prompt: z.string().min(5),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string().min(1),
      }),
    )
    .optional(),
});

router.post("/chat", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = chatSchema.parse(req.body);
    const result = await askGemini(parsed.prompt, parsed.messages || []);
    const escalationDecision = await intelligence.decideChatEscalation({
      prompt: parsed.prompt,
      response_text: result.text,
      messages: parsed.messages || [],
      requester_id: req.userId,
      limit: 3,
    });
    const experts = await User.find({
      _id: { $in: escalationDecision.experts.map((expert) => expert.expert_id) },
      isBanned: { $ne: true },
    })
      .select("name avatarUrl expertise skillTags availabilityStatus points")
      .lean();
    const expertById = new Map(experts.map((expert) => [String(expert._id), expert]));
    const escalation = {
      shouldEscalate: escalationDecision.should_escalate,
      reason: escalationDecision.reason,
      urgency: escalationDecision.urgency,
      subject: escalationDecision.subject,
      tags: escalationDecision.tags,
      experts: escalationDecision.experts
        .map((match) => {
          const expert = expertById.get(match.expert_id);
          if (!expert) return null;
          return {
            _id: String(expert._id),
            name: expert.name,
            avatarUrl: expert.avatarUrl,
            expertise: expert.expertise || [],
            skillTags: expert.skillTags || [],
            availabilityStatus: expert.availabilityStatus,
            points: expert.points || 0,
            score: match.score,
            reasons: match.reasons,
          };
        })
        .filter(Boolean),
    };

    if (!parsed.threadId) {
      return res.status(200).json({
        message: {
          body: result.text,
          isFromAi: true,
          createdAt: new Date().toISOString(),
        },
        model: result.model,
        escalation,
      });
    }

    const aiMessage = await Message.create({
      thread: parsed.threadId,
      sender: req.userId, // could be a dedicated AI user in a fuller implementation
      body: result.text,
      readBy: [{ user: req.userId, readAt: new Date() }],
      isFromAi: true,
    });

    res.status(201).json({
      message: {
        id: aiMessage.id,
        body: aiMessage.body,
        createdAt: aiMessage.createdAt,
        isFromAi: aiMessage.isFromAi,
      },
      model: result.model,
      escalation,
    });
  } catch (err) {
    next(err);
  }
});

export const aiRouter = router;

