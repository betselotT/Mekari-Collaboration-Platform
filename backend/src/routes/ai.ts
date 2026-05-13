import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { Message } from "../models/Message";

const router = Router();

const chatSchema = z.object({
  threadId: z.string().min(1),
  prompt: z.string().min(5),
});

router.post("/chat", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = chatSchema.parse(req.body);

    // Placeholder AI behaviour: echo-style guidance. In production, call a real LLM here.
    const aiText =
      "This is a placeholder AI response. Summarize the problem, share the exact error message, and check related threads in this subject. " +
      "You can also invite a human mentor by tagging them in the thread.";

    const aiMessage = await Message.create({
      thread: parsed.threadId,
      sender: req.userId, // could be a dedicated AI user in a fuller implementation
      body: aiText,
      isFromAi: true,
    });

    res.status(201).json({
      message: {
        id: aiMessage.id,
        body: aiMessage.body,
        createdAt: aiMessage.createdAt,
        isFromAi: aiMessage.isFromAi,
      },
    });
  } catch (err) {
    next(err);
  }
});

export const aiRouter = router;

