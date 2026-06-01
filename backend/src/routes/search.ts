import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { KnowledgeDoc } from "../models/KnowledgeDoc";
import { Message } from "../models/Message";
import { Thread } from "../models/Thread";

const router = Router();

const ACTIVE_THREAD_STATUSES = ["OPEN", "PENDING_EXPERT", "AI_RESOLVED"] as const;
const RESULT_LIMIT = 20;
const MAX_QUERY_TERMS = 12;
const MAX_TAGS = 12;

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTag(tag: string) {
  return tag
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildTagRegex(tag: string) {
  const normalized = normalizeTag(tag);
  if (!normalized) return undefined;

  const pattern = normalized
    .split("-")
    .map(escapeRegex)
    .join("[^a-z0-9]+");
  return new RegExp(`^${pattern}$`, "i");
}

function parseTags(rawTags: unknown) {
  if (typeof rawTags !== "string") return [];

  return [...new Set(
    rawTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, MAX_TAGS)
  )];
}

function buildTagCondition(tags: string[]) {
  const patterns = tags
    .map(buildTagRegex)
    .filter((pattern): pattern is RegExp => Boolean(pattern));

  if (!patterns.length) return undefined;
  return {
    tags: {
      $in: patterns,
    },
  };
}

function buildTextCondition(fields: string[], query: string) {
  const terms = query
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, MAX_QUERY_TERMS);

  if (!terms.length) return undefined;
  return {
    $and: terms.map((term) => ({
      $or: fields.map((field) => ({
        [field]: { $regex: escapeRegex(term), $options: "i" },
      })),
    })),
  };
}

router.get("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 240) : "";
    const tags = parseTags(req.query.tags);
    const page = positiveInteger(req.query.page, 1);
    const skip = (page - 1) * RESULT_LIMIT;

    if (!q && tags.length === 0) {
      return res.json({
        threads: [],
        knowledgeDocs: [],
        total: 0,
        knowledgeTotal: 0,
        totalResults: 0,
        page,
        pages: 0,
        knowledgePages: 0,
        limit: RESULT_LIMIT,
      });
    }

    const tagCondition = buildTagCondition(tags);
    const threadTextCondition = q
      ? buildTextCondition(["title", "subject", "body"], q)
      : undefined;
    const knowledgeTextCondition = q
      ? buildTextCondition(["title", "body", "solution", "threadSummary"], q)
      : undefined;
    const messageTextCondition = q ? buildTextCondition(["body"], q) : undefined;

    const messageThreadIds = messageTextCondition
      ? await Message.distinct("thread", {
          thread: { $exists: true, $ne: null },
          type: { $ne: "SYSTEM_EVENT" },
          ...messageTextCondition,
        })
      : [];

    const threadConditions: Record<string, unknown>[] = [
      { status: { $in: ACTIVE_THREAD_STATUSES } },
    ];
    if (tagCondition) threadConditions.push(tagCondition);
    if (threadTextCondition) {
      threadConditions.push({
        $or: [
          threadTextCondition,
          { _id: { $in: messageThreadIds } },
        ],
      });
    }

    const knowledgeConditions: Record<string, unknown>[] = [];
    if (tagCondition) knowledgeConditions.push(tagCondition);
    if (knowledgeTextCondition) knowledgeConditions.push(knowledgeTextCondition);

    const threadFilter = { $and: threadConditions };
    const knowledgeFilter = knowledgeConditions.length ? { $and: knowledgeConditions } : {};

    const [total, threads, knowledgeTotal, knowledgeDocs] = await Promise.all([
      Thread.countDocuments(threadFilter),
      Thread.find(threadFilter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(RESULT_LIMIT)
        .populate("createdBy", "name avatarUrl")
        .lean(),
      KnowledgeDoc.countDocuments(knowledgeFilter),
      KnowledgeDoc.find(knowledgeFilter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(RESULT_LIMIT)
        .lean(),
    ]);

    const threadIds = threads.map((thread) => thread._id);
    const [messageCounts, matchingMessages] = await Promise.all([
      Message.aggregate([
        { $match: { thread: { $in: threadIds } } },
        { $group: { _id: "$thread", count: { $sum: 1 } } },
      ]),
      messageTextCondition && threadIds.length
        ? Message.find({
            thread: { $in: threadIds },
            type: { $ne: "SYSTEM_EVENT" },
            ...messageTextCondition,
          })
            .sort({ updatedAt: -1 })
            .select("thread body")
            .lean()
        : Promise.resolve([]),
    ]);

    const messageCountMap = new Map<string, number>(
      messageCounts.map((count) => [String(count._id), count.count as number])
    );
    const previewMap = new Map<string, string>();
    for (const message of matchingMessages) {
      const threadId = String(message.thread);
      if (!previewMap.has(threadId)) previewMap.set(threadId, message.body.slice(0, 180));
    }

    res.json({
      threads: threads.map((thread) => ({
        ...thread,
        messageCount: messageCountMap.get(String(thread._id)) || 0,
        preview: previewMap.get(String(thread._id)) || String(thread.body || "").slice(0, 180),
      })),
      knowledgeDocs,
      total,
      knowledgeTotal,
      totalResults: total + knowledgeTotal,
      page,
      pages: Math.ceil(total / RESULT_LIMIT),
      knowledgePages: Math.ceil(knowledgeTotal / RESULT_LIMIT),
      limit: RESULT_LIMIT,
    });
  } catch (err) {
    next(err);
  }
});

export const searchRouter = router;
