import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { messageRateLimiter } from "../middleware/messageRateLimiter";
import { Thread } from "../models/Thread";
import { Message } from "../models/Message";
import { PointEvent } from "../models/PointEvent";
import { User } from "../models/User";
import { awardPoints, awardRepeatableBadge } from "../services/awardPoints";
import { captureKnowledge } from "../services/knowledgeCapture";
import { runAIPipeline } from "../services/aiPipeline";
import { broadcastToRoom, roomName } from "../services/realtime";
import { createThreadMessage, threadMessageSchema } from "../services/threadMessages";
import { generateContentTags, normalizeContentTags } from "../services/tagExtraction";
import { findSimilarProblems } from "../services/similarProblems";
import { recommendExperts } from "../services/matching";
import { createNotification } from "../services/notifications";

const router = Router();

const createThreadSchema = z.object({
  title: z.string().min(5),
  subject: z.string().min(1),
  body: z.string().optional(),
  tags: z.array(z.string().min(1)).default([]),
  initialMessage: z.string().min(1),
});

const solveSchema = z.object({
  solutionMsgId: z.string().min(1),
});

const updateTagsSchema = z.object({
  tags: z.array(z.string().min(1)).max(12),
});

async function getThreadReadStats(threadIds: unknown[]) {
  const [messageCounts, upvoteCounts] = await Promise.all([
    Message.aggregate([
      { $match: { thread: { $in: threadIds } } },
      { $group: { _id: "$thread", count: { $sum: 1 } } },
    ]),
    Message.aggregate([
      { $match: { thread: { $in: threadIds } } },
      { $project: { thread: 1, upvoteCount: { $size: { $ifNull: ["$upvotes", []] } } } },
      { $group: { _id: "$thread", count: { $sum: "$upvoteCount" } } },
    ]),
  ]);

  return {
    messageCountMap: new Map<string, number>(
      messageCounts.map((count) => [String(count._id), count.count as number])
    ),
    upvoteCountMap: new Map<string, number>(
      upvoteCounts.map((count) => [String(count._id), count.count as number])
    ),
  };
}

// Public GET /public - list threads without authentication
router.get("/public", async (req, res, next) => {
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

    const threadIds = threads.map((thread) => thread._id);
    const { messageCountMap, upvoteCountMap } = await getThreadReadStats(threadIds);

    res.json({
      threads: threads.map((thread) => {
        const messageCount = messageCountMap.get(String(thread._id)) || 0;
        return {
          ...thread.toObject(),
          messageCount,
          repliesCount: Math.max(0, messageCount - 1),
          upvoteCount: upvoteCountMap.get(String(thread._id)) || 0,
        };
      }),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// Public GET /public/:threadId - view one thread without authentication
router.get("/public/:threadId", async (req, res, next) => {
  try {
    const thread = await Thread.findById(req.params.threadId)
      .populate("createdBy", "name avatarUrl")
      .populate("matchedExperts", "name avatarUrl expertise availabilityStatus points badges");

    if (!thread) return res.status(404).json({ error: { message: "Thread not found" } });

    const { messageCountMap, upvoteCountMap } = await getThreadReadStats([thread._id]);
    const messageCount = messageCountMap.get(String(thread._id)) || 0;

    res.json({
      thread: {
        ...thread.toObject(),
        messageCount,
        repliesCount: Math.max(0, messageCount - 1),
        upvoteCount: upvoteCountMap.get(String(thread._id)) || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET / — list threads with filters + pagination
// Public GET /public/:threadId/messages - view replies without authentication
router.get("/public/:threadId/messages", async (req, res, next) => {
  try {
    const threadExists = await Thread.exists({ _id: req.params.threadId });
    if (!threadExists) {
      return res.status(404).json({ error: { message: "Thread not found" } });
    }

    const messages = await Message.find({ thread: req.params.threadId })
      .sort({ createdAt: 1 })
      .populate("sender", "name avatarUrl");

    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

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
    let threadDoc = await Thread.findById(req.params.threadId);
    if (!threadDoc) return res.status(404).json({ error: { message: "Thread not found" } });

    if (!threadDoc.matchedExperts?.length) {
      const recommendations = await recommendExperts({
        requesterId: String(threadDoc.createdBy),
        subject: threadDoc.subject,
        tags: threadDoc.tags,
        title: threadDoc.title,
        body: threadDoc.body ?? "",
        availabilityPreference: "any",
        limit: 3,
      });
      if (recommendations.length > 0) {
        threadDoc = await Thread.findByIdAndUpdate(
          req.params.threadId,
          { $set: { matchedExperts: recommendations.map((rec) => rec.expertId) } },
          { new: true }
        );
      }
    }

    const thread = await Thread.findById(req.params.threadId)
      .populate("createdBy", "name avatarUrl")
      .populate("matchedExperts", "name avatarUrl expertise skillTags availabilityStatus points badges");

    if (!thread) return res.status(404).json({ error: { message: "Thread not found" } });
    res.json({ thread });
  } catch (err) {
    next(err);
  }
});

// GET /:threadId/similar - retrieve solved threads/knowledge docs related to this thread
router.get("/:threadId/similar", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const thread = await Thread.findById(req.params.threadId);
    if (!thread) return res.status(404).json({ error: { message: "Thread not found" } });
    const messages = await Message.find({ thread: thread._id })
      .sort({ createdAt: 1 })
      .limit(4)
      .select("body type")
      .lean();
    const messageText = messages
      .filter((message) => message.type !== "SYSTEM_EVENT")
      .map((message) => message.body)
      .filter(Boolean)
      .join("\n\n");

    const similarProblems = await findSimilarProblems({
      threadId: String(thread._id),
      title: thread.title,
      body: [thread.body, messageText].filter(Boolean).join("\n\n"),
      subject: thread.subject,
      tags: thread.tags,
      limit: Math.min(10, Math.max(1, Number(req.query.limit ?? 5))),
    });

    await Thread.findByIdAndUpdate(thread._id, {
      $set: { similarProblems },
    });

    res.json({ problems: similarProblems });
  } catch (err) {
    next(err);
  }
});

// PATCH /:threadId/tags - let the author or moderators curate generated tags
router.patch("/:threadId/tags", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = updateTagsSchema.parse(req.body);
    const thread = await Thread.findById(req.params.threadId);
    if (!thread) return res.status(404).json({ error: { message: "Thread not found" } });

    const canEdit =
      String(thread.createdBy) === String(req.userId) ||
      req.userRole === "admin" ||
      req.userRole === "mod";
    if (!canEdit) {
      return res.status(403).json({ error: { message: "Only the thread author can edit tags" } });
    }

    const tags = normalizeContentTags(parsed.tags);
    const updated = await Thread.findByIdAndUpdate(
      req.params.threadId,
      { $set: { tags, updatedAt: new Date() } },
      { new: true }
    );

    await broadcastToRoom(roomName("thread", req.params.threadId), "thread_tags_updated", {
      threadId: req.params.threadId,
      tags,
      addedTags: [],
    });

    res.json({ thread: updated });
  } catch (err) {
    next(err);
  }
});

// POST / — create thread, fire AI pipeline async (CRITICAL BEHAVIOR #1)
router.post("/", requireAuth, messageRateLimiter, async (req: AuthRequest, res, next) => {
  try {
    const parsed = createThreadSchema.parse(req.body);
    const duplicateWindow = new Date(Date.now() - 30_000);
    const recentSameTitle = await Thread.findOne({
      createdBy: req.userId,
      title: parsed.title.trim(),
      subject: parsed.subject.trim(),
      createdAt: { $gte: duplicateWindow },
    }).sort({ createdAt: -1 });

    if (recentSameTitle) {
      const existingInitialMessage = await Message.findOne({
        thread: recentSameTitle._id,
        sender: req.userId,
        body: parsed.initialMessage,
      }).select("_id");

      if (existingInitialMessage) {
        await recentSameTitle.populate([
          { path: "createdBy", select: "name avatarUrl" },
          {
            path: "matchedExperts",
            select: "name avatarUrl expertise skillTags availabilityStatus points badges",
          },
        ]);
        return res.status(200).json({ thread: recentSameTitle, duplicate: true });
      }
    }

    const tags = await generateContentTags({
      title: parsed.title,
      subject: parsed.subject,
      body: [parsed.body, parsed.initialMessage].filter(Boolean).join("\n\n"),
      existingTags: parsed.tags,
    });
    const questionText = [parsed.body, parsed.initialMessage].filter(Boolean).join("\n\n");
    const recommendations = await recommendExperts({
      requesterId: req.userId,
      subject: parsed.subject,
      tags,
      title: parsed.title,
      body: questionText,
      availabilityPreference: "any",
      limit: 3,
    });
    const recommendedExpertIds = recommendations.map((rec) => rec.expertId);

    const thread = await Thread.create({
      title: parsed.title,
      subject: parsed.subject,
      body: parsed.body || parsed.initialMessage,
      tags,
      createdBy: req.userId,
      participants: [req.userId],
      matchedExperts: recommendedExpertIds,
      status: "OPEN",
    });

    await Message.create({
      thread: thread.id,
      sender: req.userId,
      body: parsed.initialMessage,
      type: "TEXT",
      isFromAi: false,
    });

    const experts = await User.find({ _id: { $in: recommendedExpertIds } })
      .select("name avatarUrl expertise skillTags availabilityStatus points badges")
      .lean();
    const expertMap = new Map(experts.map((expert) => [String(expert._id), expert]));
    const suggestedExperts = recommendations
      .map((rec) => {
        const expert = expertMap.get(rec.expertId);
        if (!expert) return null;
        return { expert, score: rec.score, reasons: rec.reasons };
      })
      .filter(Boolean);

    await Promise.all(
      recommendedExpertIds.map((expertId) =>
        createNotification({
          userId: expertId,
          category: "chat",
          type: "expert_suggested",
          title: "Matched to a learner question",
          message: `You may be able to help with: "${thread.title}"`,
          link: `/dashboard/threads/${thread.id}`,
        })
      )
    );

    await thread.populate([
      { path: "createdBy", select: "name avatarUrl" },
      {
        path: "matchedExperts",
        select: "name avatarUrl expertise skillTags availabilityStatus points badges",
      },
    ]);

    // Respond to client immediately, then fire AI pipeline
    res.status(201).json({ thread, suggestedExperts });

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
    const parsed = threadMessageSchema.parse(req.body);
    const { message } = await createThreadMessage({
      threadId,
      userId: String(req.userId),
      body: parsed.body,
      type: parsed.type,
      attachmentUrl: parsed.attachmentUrl,
      parentMessageId: parsed.parentMessageId,
    });

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
});

// POST /:threadId/messages/:messageId/upvote - toggle an upvote on a message
router.post("/:threadId/messages/:messageId/upvote", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { threadId, messageId } = req.params;

    const message = await Message.findOne({ _id: messageId, thread: threadId });
    if (!message) {
      return res.status(404).json({ error: { message: "Message not found" } });
    }

    if (message.isFromAi || message.type === "SYSTEM_EVENT") {
      return res.status(400).json({ error: { message: "This message cannot be upvoted" } });
    }

    if (String(message.sender) === String(req.userId)) {
      return res.status(403).json({ error: { message: "You cannot upvote your own message" } });
    }

    const hasUpvoted = message.upvotes.some((id) => String(id) === String(req.userId));
    const updated = await Message.findByIdAndUpdate(
      messageId,
      hasUpvoted
        ? { $pull: { upvotes: req.userId } }
        : { $addToSet: { upvotes: req.userId } },
      { new: true }
    ).populate("sender", "name avatarUrl");

    if (!updated) {
      return res.status(404).json({ error: { message: "Message not found" } });
    }

    if (!hasUpvoted) {
      const alreadyAwarded = await PointEvent.exists({
        userId: message.sender,
        eventType: "RECEIVED_UPVOTE",
        refId: message._id,
      });
      if (!alreadyAwarded) {
        await awardPoints(String(message.sender), "RECEIVED_UPVOTE", String(message._id));
      }
    }

    await broadcastToRoom(roomName("thread", threadId), "message_upvoted", {
      threadId,
      messageId,
      upvotes: updated.upvotes,
    });

    res.json({ message: updated, upvoted: !hasUpvoted });
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
        await awardRepeatableBadge(String(solutionMsg.sender), "AI Beater", threadId);
      }

      // Speed Demon badge: solved in under 5 minutes
      const createdAt = thread.createdAt as unknown as Date;
      const elapsed = Date.now() - new Date(createdAt).getTime();
      if (elapsed < 5 * 60 * 1000) {
        await awardRepeatableBadge(String(solutionMsg.sender), "Speed Demon", threadId);
      }
    }

    await broadcastToRoom(roomName("thread", threadId), "thread_solved", {
      threadId,
      solutionMsgId: parsed.solutionMsgId,
      solvedBy: solutionMsg.sender,
    });

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

    await broadcastToRoom(roomName("thread", threadId), "new_message", {
      _id: systemMsg.id,
      id: systemMsg.id,
      thread: threadId,
      sender: req.userId,
      body: systemMsg.body,
      type: "SYSTEM_EVENT",
      isFromAi: false,
      createdAt: systemMsg.createdAt,
    });

    res.json({ meetLink, message: systemMsg });
  } catch (err) {
    next(err);
  }
});

// DELETE /:threadId/messages/:messageId - delete own message, or any message as admin/mod
router.delete("/:threadId/messages/:messageId", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { threadId, messageId } = req.params;

    const message = await Message.findOne({ _id: messageId, thread: threadId });
    if (!message) {
      return res.status(404).json({ error: { message: "Message not found" } });
    }

    const isOwner = String(message.sender) === String(req.userId);
    const isModerator = req.userRole === "admin" || req.userRole === "mod";
    if (!isOwner && !isModerator) {
      return res.status(403).json({ error: { message: "You can only delete your own messages" } });
    }

    const thread = await Thread.findById(threadId).select("solutionMsgId");
    if (!thread) {
      return res.status(404).json({ error: { message: "Thread not found" } });
    }

    if (thread.solutionMsgId && String(thread.solutionMsgId) === String(message._id)) {
      return res.status(409).json({
        error: { message: "Cannot delete the message marked as the solution" },
      });
    }

    await Message.findByIdAndDelete(message._id);
    await Thread.findByIdAndUpdate(threadId, { $set: { updatedAt: new Date() } });

    await broadcastToRoom(roomName("thread", threadId), "message_deleted", {
      threadId,
      messageId,
      deletedBy: req.userId,
    });

    res.json({ deleted: true, messageId });
  } catch (err) {
    next(err);
  }
});

export const threadRouter = router;
