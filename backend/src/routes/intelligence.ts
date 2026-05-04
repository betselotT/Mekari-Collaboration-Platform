/**
 * Thin proxy that exposes the Python intelligence service to the frontend.
 * Heavy computation stays in Python; this route just forwards authenticated requests.
 */
import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import * as intelligence from "../intelligence/client";

const router = Router();

router.get("/health", requireAuth, async (_req, res, next) => {
  try {
    const available = await intelligence.isAvailable();
    res.json({ available });
  } catch (err) {
    next(err);
  }
});

router.post("/tags", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { title = "", body = "", subject = "", existing_tags = [] } = req.body as Record<string, unknown>;
    const tags = await intelligence.suggestTags({
      title: String(title),
      body: String(body),
      subject: String(subject),
      existing_tags: Array.isArray(existing_tags) ? existing_tags.map(String) : [],
    });
    res.json({ tags });
  } catch (err) {
    next(err);
  }
});

router.post("/similar", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { title = "", tags = [], subject = "", limit = 5 } = req.body as Record<string, unknown>;
    const problems = await intelligence.findSimilar({
      title: String(title),
      tags: Array.isArray(tags) ? tags.map(String) : [],
      subject: String(subject),
      limit: Number(limit),
    });
    res.json({ problems });
  } catch (err) {
    next(err);
  }
});

router.post("/experts", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const {
      subject = "",
      tags = [],
      availability_preference = "online_or_busy",
      limit = 5,
    } = req.body as Record<string, unknown>;
    const experts = await intelligence.matchExperts({
      subject: String(subject),
      tags: Array.isArray(tags) ? tags.map(String) : [],
      requester_id: req.userId,
      availability_preference: String(availability_preference),
      limit: Number(limit),
    });
    res.json({ experts });
  } catch (err) {
    next(err);
  }
});

export { router as intelligenceRouter };
