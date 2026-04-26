import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { Thread } from "../models/Thread";
import { Message } from "../models/Message";

const router = Router();

const createThreadSchema = z.object({
  title: z.string().min(5),
  subject: z.string().min(1),
  initialMessage: z.string().min(1),
});

router.get("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const subject = req.query.subject as string | undefined;
    const filter: any = {};
    if (subject) filter.subject = subject;

    const threads = await Thread.find(filter)
      .sort({ updatedAt: -1 })
      .limit(50)
      .populate("createdBy", "name avatarUrl");
    const threadIds = threads.map((t) => t._id);
    const counts = await Message.aggregate([
      { $match: { thread: { $in: threadIds } } },
      { $group: { _id: "$thread", count: { $sum: 1 } } },
    ]);
    const countMap = new Map<string, number>(
      counts.map((c) => [String(c._id), c.count as number])
    );

    const previews = await Message.find({ thread: { $in: threadIds } })
      .sort({ createdAt: -1 })
      .select("thread body createdAt")
      .lean();
    const previewMap = new Map<string, string>();
    for (const m of previews) {
      const key = String(m.thread);
      if (!previewMap.has(key)) {
        previewMap.set(key, String(m.body || "").slice(0, 160));
      }
    }

    res.json({
      threads: threads.map((t) => ({
        ...t.toObject(),
        messageCount: countMap.get(String(t._id)) || 0,
        preview: previewMap.get(String(t._id)) || "",
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = createThreadSchema.parse(req.body);
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

    res.status(201).json({ thread });
  } catch (err) {
    next(err);
  }
});

router.get("/:threadId/messages", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { threadId } = req.params;
    const messages = await Message.find({ thread: threadId })
      .sort({ createdAt: 1 })
      .populate("sender", "name avatarUrl");
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

const sendMessageSchema = z.object({
  body: z.string().min(1),
});

router.post("/:threadId/messages", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { threadId } = req.params;
    const parsed = sendMessageSchema.parse(req.body);

    const message = await Message.create({
      thread: threadId,
      sender: req.userId,
      body: parsed.body,
      isFromAi: false,
    });

    await Thread.findByIdAndUpdate(threadId, {
      $addToSet: { participants: req.userId },
      $set: { updatedAt: new Date() },
    });

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
});

export const threadRouter = router;

