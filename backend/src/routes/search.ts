import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { Thread } from "../models/Thread";
import { KnowledgeDoc } from "../models/KnowledgeDoc";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const tags = req.query.tags as string | undefined;
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = 20;
    const skip = (page - 1) * limit;

    if (!q && !tags) {
      return res.json({ threads: [], knowledgeDocs: [], total: 0, page, pages: 0 });
    }

    const threadFilter: Record<string, unknown> = {};
    const conditions: Record<string, unknown>[] = [];

    if (q) {
      conditions.push({
        $or: [
          { title: { $regex: q, $options: "i" } },
          { subject: { $regex: q, $options: "i" } },
          { body: { $regex: q, $options: "i" } },
        ],
      });
    }

    if (tags) {
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) conditions.push({ tags: { $in: tagList } });
    }

    if (conditions.length === 1) {
      Object.assign(threadFilter, conditions[0]);
    } else if (conditions.length > 1) {
      threadFilter.$and = conditions;
    }

    const [total, threads, knowledgeDocs] = await Promise.all([
      Thread.countDocuments(threadFilter),
      Thread.find(threadFilter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name avatarUrl")
        .lean(),
      q
        ? KnowledgeDoc.find({
            $or: [
              { title: { $regex: q, $options: "i" } },
              { threadSummary: { $regex: q, $options: "i" } },
            ],
          })
            .limit(5)
            .lean()
        : Promise.resolve([]),
    ]);

    res.json({ threads, knowledgeDocs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

export const searchRouter = router;
