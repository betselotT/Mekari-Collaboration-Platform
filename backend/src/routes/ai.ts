import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { Message } from "../models/Message";
import { askGemini } from "../services/gemini";
import { decideAiEscalation } from "../services/aiEscalation";

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
    const escalation = await decideAiEscalation({
      requesterId: req.userId,
      prompt: parsed.prompt,
      responseText: result.text,
      messages: parsed.messages || [],
    });

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

