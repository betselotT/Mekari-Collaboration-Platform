import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { Report } from "../models/Report";

const router = Router();

const createReportSchema = z.object({
  targetType: z.enum(["thread", "message", "user"]),
  targetId: z.string().min(1),
  reason: z.string().min(5).max(1000),
});

router.post("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = createReportSchema.parse(req.body);
    const report = await Report.create({ reporterId: req.userId, ...parsed });
    res.status(201).json({ report });
  } catch (err) {
    next(err);
  }
});

export const reportRouter = router;
