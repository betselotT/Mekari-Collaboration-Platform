import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { Thread } from "../models/Thread";
import { Message } from "../models/Message";

const router = Router();

router.get("/overview", requireAuth, async (_req: AuthRequest, res, next) => {
  try {
    const [threadCount, messageCount] = await Promise.all([
      Thread.countDocuments(),
      Message.countDocuments(),
    ]);

    res.json({
      metrics: {
        threadCount,
        messageCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

export const analyticsRouter = router;

