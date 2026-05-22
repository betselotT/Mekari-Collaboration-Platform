import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { getWhiteboard } from "../services/whiteboards";

const router = Router();

router.get("/:roomId", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const board = await getWhiteboard(req.params.roomId, String(req.userId));
    res.json({ board });
  } catch (err) {
    const status =
      typeof err === "object" && err && "status" in err
        ? Number((err as { status?: number }).status || 500)
        : 500;
    if (status !== 500) {
      return res.status(status).json({ error: { message: (err as Error).message } });
    }
    next(err);
  }
});

export const whiteboardRouter = router;
