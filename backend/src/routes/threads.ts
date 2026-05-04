import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { Thread } from "../models/Thread";
import { Message } from "../models/Message";
import { PointEvent } from "../models/PointEvent";
import { awardPoints } from "../services/awardPoints";
import { captureKnowledge } from "../services/knowledgeCapture";
import { runAIPipeline } from "../services/aiPipeline";
import { getIo } from "../sockets/ioInstance";

const router = Router();

const createThreadSchema = z.object({
  title: z.string().min(5),
  subject: z.string().min(1),
  body: z.string().optional(),
  tags: z.array(z.string().min(1)).default([]),
  initialMessage: z.string().min(1),
});

const sendMessageSchema = z.object({
  body: z.string().min(1),
  type: z.enum(["TEXT", "CODE", "IMAGE", "FILE", "SYSTEM_EVENT"]).optional(),
  parentMessageId: z.string().optional(),
});

const solveSchema = z.object({
  solutionMsgId: z.string().min(1),
});

// GET / — list threads with filters + pagination
router.get("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const subject = req.query.subject as string | undefined;
    const status = req.query.status as string | undefined;
    const tags = req.query.tags as string | undefined;
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (subject) filter.subject = subject;
    if (status) filter.status = status;
    if (tags) {
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) filter.tags = { $in: tagList };
    }

    const [total, threads] = await Promise.all([
      Thread.countDocuments(filter),
      Thread.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name avatarUrl"),
    ]);

    const threadIds = threads.map((t) => t._id);

    const [counts, previews] = await Promise.all([
      Message.aggregate([
        { $match: { thread: { $in: threadIds } } },
        { $group: { _id: "$thread", count: { $sum: 1 } } },
      ]),
      Message.find({ thread: { $in: threadIds } })
        .sort({ createdAt: -1 })
        .select("thread body createdAt")
        .lean(),
    ]);

    const countMap = new Map<string, number>(
      counts.map((c) => [String(c._id), c.count as number])
    );
    const previewMap = new Map<string, string>();
    for (const m of previews) {
      const key = String(m.thread);
      if (!previewMap.has(key)) previewMap.set(key, String(m.body || "").slice(0, 160));
    }

    res.json({
      threads: threads.map((t) => ({
        ...t.toObject(),
        messageCount: countMap.get(String(t._id)) || 0,
        preview: previewMap.get(String(t._id)) || "",
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// GET /:threadId — single thread with populated experts
router.get("/:threadId", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const thread = await Thread.findById(req.params.threadId)
      .populate("createdBy", "name avatarUrl")
      .populate("matchedExperts", "name avatarUrl expertise availabilityStatus points badges");

    if (!thread) return res.status(404).json({ error: { message: "Thread not found" } });
    res.json({ thread });
  } catch (err) {
    next(err);
  }
});

// POST / — create thread, fire AI pipeline async (CRITICAL BEHAVIOR #1)
router.post("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = createThreadSchema.parse(req.body);

    const thread = await Thread.create({
      title: parsed.title,
      subject: parsed.subject,
      body: parsed.body,
      tags: parsed.tags,
      createdBy: req.userId,
      participants: [req.userId],
      status: "OPEN",
    });

    await Message.create({
      thread: thread.id,
      sender: req.userId,
      body: parsed.initialMessage,
      type: "TEXT",
      isFromAi: false,
    });

    // Respond to client immediately, then fire AI pipeline
    res.status(201).json({ thread });

    setImmediate(() => {
      runAIPipeline(String(thread._id)).catch((err) =>
        console.error("[threads POST] AI pipeline error", err)
      );
    });
  } catch (err) {
    next(err);
  }
});

// GET /:threadId/messages
router.get("/:threadId/messages", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const messages = await Message.find({ thread: req.params.threadId })
      .sort({ createdAt: 1 })
      .populate("sender", "name avatarUrl");
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

// POST /:threadId/messages — send message via REST + broadcast via socket
router.post("/:threadId/messages", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { threadId } = req.params;
    const parsed = sendMessageSchema.parse(req.body);

    const thread = await Thread.findById(threadId);
    if (!thread) return res.status(404).json({ error: { message: "Thread not found" } });

    const message = await Message.create({
      thread: threadId,
      sender: req.userId,
      body: parsed.body,
      type: parsed.type || "TEXT",
      parentMessageId: parsed.parentMessageId || undefined,
      isFromAi: false,
    });

    await Thread.findByIdAndUpdate(threadId, {
      $addToSet: { participants: req.userId },
      $set: { updatedAt: new Date() },
    });

    const populated = await message.populate("sender", "name avatarUrl");

    const io = getIo();
    if (io) {
      io.to(`room:${threadId}`).emit("new_message", {
        id: message.id,
        thread: threadId,
        sender: populated.sender,
        body: message.body,
        type: message.type,
        parentMessageId: message.parentMessageId,
        upvotes: [],
        isFromAi: false,
        createdAt: message.createdAt,
      });
    }

    // Award ANSWERED_QUESTION to first responders (not the thread author)
    if (String(thread.createdBy) !== String(req.userId)) {
      await awardPoints(String(req.userId), "ANSWERED_QUESTION", String(message._id));

      // Bonus: first answer of the day
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayAnswers = await PointEvent.countDocuments({
        userId: req.userId,
        eventType: "ANSWERED_QUESTION",
        createdAt: { $gte: todayStart },
      });
      if (todayAnswers === 1) {
        await awardPoints(String(req.userId), "FIRST_ANSWER_OF_DAY", String(message._id));
      }
    }

    res.status(201).json({ message: populated });
  } catch (err) {
    next(err);
  }
});

// PATCH /:threadId/solve — mark solved, capture knowledge (CRITICAL BEHAVIOR #5)
router.patch("/:threadId/solve", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { threadId } = req.params;
    const parsed = solveSchema.parse(req.body);

    const thread = await Thread.findById(threadId);
    if (!thread) return res.status(404).json({ error: { message: "Thread not found" } });

    if (String(thread.createdBy) !== String(req.userId)) {
      return res.status(403).json({ error: { message: "Only the thread author can mark it solved" } });
    }

    const solutionMsg = await Message.findById(parsed.solutionMsgId);
    if (!solutionMsg) return res.status(404).json({ error: { message: "Solution message not found" } });

    const updated = await Thread.findByIdAndUpdate(
      threadId,
      {
        $set: {
          status: "SOLVED",
          isSolved: true,
          solvedBy: solutionMsg.sender,
          solutionMsgId: parsed.solutionMsgId,
          resolvedAt: new Date(),
        },
      },
      { new: true }
    );

    // Award points to solution author (not AI, not the thread author)
    if (!solutionMsg.isFromAi && String(solutionMsg.sender) !== String(req.userId)) {
      await awardPoints(String(solutionMsg.sender), "ANSWER_MARKED_SOLUTION", threadId);

      // AI Beater badge: the thread was PENDING_EXPERT (AI couldn't resolve it)
      if (thread.status === "PENDING_EXPERT" || (thread.aiResponse && !thread.aiResponse.resolved)) {
        const { User } = await import("../models/User");
        const solver = await User.findById(solutionMsg.sender).select("badges");
        if (solver && !solver.badges.includes("AI Beater")) {
          await User.findByIdAndUpdate(solutionMsg.sender, {
            $addToSet: { badges: "AI Beater" },
          });
        }
      }

      // Speed Demon badge: solved in under 5 minutes
      const createdAt = thread.createdAt as unknown as Date;
      const elapsed = Date.now() - new Date(createdAt).getTime();
      if (elapsed < 5 * 60 * 1000) {
        const { User } = await import("../models/User");
        const solver = await User.findById(solutionMsg.sender).select("badges");
        if (solver && !solver.badges.includes("Speed Demon")) {
          await User.findByIdAndUpdate(solutionMsg.sender, {
            $addToSet: { badges: "Speed Demon" },
          });
        }
      }
    }

    const io = getIo();
    if (io) {
      io.to(`room:${threadId}`).emit("thread_solved", {
        threadId,
        solutionMsgId: parsed.solutionMsgId,
        solvedBy: solutionMsg.sender,
      });
    }

    // Capture knowledge asynchronously (CRITICAL BEHAVIOR #5)
    setImmediate(() => {
      captureKnowledge(threadId).catch((err) =>
        console.error("[threads PATCH solve] knowledge capture error", err)
      );
    });

    res.json({ thread: updated });
  } catch (err) {
    next(err);
  }
});

// POST /:threadId/session — start live Google Meet session (CRITICAL BEHAVIOR #4)
router.post("/:threadId/session", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { threadId } = req.params;

    const thread = await Thread.findById(threadId);
    if (!thread) return res.status(404).json({ error: { message: "Thread not found" } });

    if (String(thread.createdBy) !== String(req.userId)) {
      return res.status(403).json({ error: { message: "Only the thread author can start a session" } });
    }

    // Re-use existing link or generate a new placeholder
    // (replace with real Google Meet API call when GOOGLE_MEET_API_KEY is present)
    let meetLink = thread.googleMeetLink;
    if (!meetLink) {
      const code = Math.random().toString(36).slice(2, 5) + "-" +
                   Math.random().toString(36).slice(2, 5) + "-" +
                   Math.random().toString(36).slice(2, 5);
      meetLink = `https://meet.google.com/${code}`;
    }

    await Thread.findByIdAndUpdate(threadId, {
      $set: { googleMeetLink: meetLink },
    });

    // Post SYSTEM_EVENT message so all room members see it via new_message
    const systemMsg = await Message.create({
      thread: threadId,
      sender: req.userId,
      body: `Live session started! Join here: ${meetLink}`,
      type: "SYSTEM_EVENT",
      isFromAi: false,
    });

    const io = getIo();
    if (io) {
      io.to(`room:${threadId}`).emit("new_message", {
        id: systemMsg.id,
        thread: threadId,
        sender: req.userId,
        body: systemMsg.body,
        type: "SYSTEM_EVENT",
        isFromAi: false,
        createdAt: systemMsg.createdAt,
      });
    }

    res.json({ meetLink, message: systemMsg });
  } catch (err) {
    next(err);
  }
});

export const threadRouter = router;
