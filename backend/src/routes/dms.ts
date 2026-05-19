import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { messageRateLimiter } from "../middleware/messageRateLimiter";
import {
  createDmConversationSchema,
  createDmMessage,
  deleteDmMessage,
  dmMessageSchema,
  endDmSession,
  endDmSessionSchema,
  findOrCreateDmConversation,
  getActiveDmSession,
  getConversationForUser,
  listDmConversations,
  listDmMessages,
  markDmMessagesRead,
  startDmSession,
} from "../services/dmMessages";

const router = Router();

function statusFromError(err: unknown) {
  return typeof err === "object" && err && "status" in err
    ? Number((err as { status?: number }).status || 500)
    : 500;
}

router.get("/conversations", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const conversations = await listDmConversations(String(req.userId));
    res.json({ conversations });
  } catch (err) {
    next(err);
  }
});

router.post("/conversations", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = createDmConversationSchema.parse(req.body);
    const conversation = await findOrCreateDmConversation(String(req.userId), parsed.expertId);
    res.status(201).json({ conversation });
  } catch (err) {
    const status = statusFromError(err);
    if (status !== 500) return res.status(status).json({ error: { message: (err as Error).message } });
    next(err);
  }
});

router.get("/conversations/:conversationId", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const conversation = await getConversationForUser(
      req.params.conversationId,
      String(req.userId)
    );
    if (!conversation) {
      return res.status(404).json({ error: { message: "Conversation not found" } });
    }
    await conversation.populate("participants", "name avatarUrl role availabilityStatus");
    await conversation.populate("learner", "name avatarUrl role availabilityStatus");
    await conversation.populate("expert", "name avatarUrl role availabilityStatus");
    res.json({ conversation });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/conversations/:conversationId/messages",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    try {
      const messages = await listDmMessages(req.params.conversationId, String(req.userId));
      res.json({ messages });
    } catch (err) {
      const status = statusFromError(err);
      if (status !== 500) {
        return res.status(status).json({ error: { message: (err as Error).message } });
      }
      next(err);
    }
  }
);

router.post(
  "/conversations/:conversationId/messages",
  requireAuth,
  messageRateLimiter,
  async (req: AuthRequest, res, next) => {
    try {
      const parsed = dmMessageSchema.parse(req.body);
      const { message } = await createDmMessage({
        conversationId: req.params.conversationId,
        userId: String(req.userId),
        body: parsed.body,
        type: parsed.type,
        attachmentUrl: parsed.attachmentUrl,
        parentMessageId: parsed.parentMessageId,
      });
      res.status(201).json({ message });
    } catch (err) {
      const status = statusFromError(err);
      if (status !== 500) {
        return res.status(status).json({ error: { message: (err as Error).message } });
      }
      next(err);
    }
  }
);

router.post(
  "/conversations/:conversationId/read",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    try {
      const result = await markDmMessagesRead(req.params.conversationId, String(req.userId));
      res.json(result);
    } catch (err) {
      const status = statusFromError(err);
      if (status !== 500) {
        return res.status(status).json({ error: { message: (err as Error).message } });
      }
      next(err);
    }
  }
);

router.post(
  "/conversations/:conversationId/session",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    try {
      const result = await startDmSession(req.params.conversationId, String(req.userId));
      res.status(result.alreadyActive ? 200 : 201).json(result);
    } catch (err) {
      const status = statusFromError(err);
      if (status !== 500) {
        return res.status(status).json({ error: { message: (err as Error).message } });
      }
      next(err);
    }
  }
);

router.get(
  "/conversations/:conversationId/session",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    try {
      const session = await getActiveDmSession(req.params.conversationId, String(req.userId));
      res.json({ session });
    } catch (err) {
      const status = statusFromError(err);
      if (status !== 500) {
        return res.status(status).json({ error: { message: (err as Error).message } });
      }
      next(err);
    }
  }
);

router.post(
  "/conversations/:conversationId/session/end",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    try {
      const parsed = endDmSessionSchema.parse(req.body || {});
      const result = await endDmSession(req.params.conversationId, String(req.userId), parsed);
      res.json(result);
    } catch (err) {
      const status = statusFromError(err);
      if (status !== 500) {
        return res.status(status).json({ error: { message: (err as Error).message } });
      }
      next(err);
    }
  }
);

router.delete(
  "/conversations/:conversationId/messages/:messageId",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    try {
      const deleted = await deleteDmMessage(
        req.params.conversationId,
        req.params.messageId,
        String(req.userId)
      );
      res.json({ deleted: true, ...deleted });
    } catch (err) {
      const status = statusFromError(err);
      if (status !== 500) {
        return res.status(status).json({ error: { message: (err as Error).message } });
      }
      next(err);
    }
  }
);

export const dmRouter = router;
