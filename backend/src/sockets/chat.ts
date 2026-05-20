import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { RedisClientType } from "redis";
import { z } from "zod";
import { createThreadMessage, markThreadMessagesRead, threadMessageSchema } from "../services/threadMessages";
import {
  broadcastToRoom,
  forgetSocketPresence,
  markUserPresence,
  rememberSocketUser,
  roomName,
} from "../services/realtime";
import {
  createDmMessage,
  dmMessageSchema,
  markDmMessagesRead,
  userCanAccessDm,
} from "../services/dmMessages";
import { User } from "../models/User";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const socketThreadMessageSchema = threadMessageSchema.extend({
  threadId: z.string().min(1),
});
const socketDmMessageSchema = dmMessageSchema.extend({
  conversationId: z.string().min(1),
});

type SocketAuth = {
  sub?: string;
  role?: string;
};

const typingUserNameCache = new Map<string, string>();

async function getTypingUserName(userId: string) {
  const cached = typingUserNameCache.get(userId);
  if (cached) return cached;

  const user = await User.findById(userId).select("name email").lean().catch(() => null);
  const name = user?.name || user?.email || "Someone";
  typingUserNameCache.set(userId, name);
  return name;
}

function authenticateSocket(socket: Socket) {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SocketAuth;
    if (!decoded.sub) return null;
    socket.data.userId = decoded.sub;
    socket.data.userRole = decoded.role;
    socket.join(roomName("user", decoded.sub));
    rememberSocketUser(socket.id, decoded.sub);
    return decoded.sub;
  } catch {
    return null;
  }
}

export function registerChatHandlers(
  io: Server,
  _redis?: RedisClientType<any, any, any> | null
) {
  io.on("connection", (socket: Socket) => {
    const connectedUserId = authenticateSocket(socket);
    if (connectedUserId) {
      markUserPresence(socket.id, connectedUserId, "online").catch((err) =>
        console.error("[socket presence online]", err)
      );
    }

    socket.on("join_room", (threadId: string) => {
      if (!threadId) return;
      socket.join(roomName("thread", threadId));
    });

    socket.on("leave_room", (threadId: string) => {
      if (!threadId) return;
      socket.leave(roomName("thread", threadId));
    });

    socket.on("send_message", async (payload: unknown) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId) return;

      const parsed = socketThreadMessageSchema.safeParse(payload);
      if (!parsed.success) return;

      try {
        await createThreadMessage({
          threadId: parsed.data.threadId,
          userId,
          body: parsed.data.body,
          type: parsed.data.type,
          attachmentUrl: parsed.data.attachmentUrl,
          parentMessageId: parsed.data.parentMessageId,
        });
      } catch (err) {
        console.error("[socket send_message]", err);
      }
    });

    socket.on("typing_start", async (threadId: string) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId || !threadId) return;
      const userName = await getTypingUserName(userId);
      broadcastToRoom(roomName("thread", threadId), "user_typing", {
        userId,
        userName,
        threadId,
      });
    });

    socket.on("typing_stop", (threadId: string) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId || !threadId) return;
      broadcastToRoom(roomName("thread", threadId), "user_stopped_typing", { userId, threadId });
    });

    socket.on("thread_mark_read", async (threadId: string) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId || !threadId) return;
      try {
        await markThreadMessagesRead(threadId, userId);
      } catch (err) {
        console.error("[socket thread_mark_read]", err);
      }
    });

    socket.on("join_dm", async (conversationId: string) => {
      const userId = socket.data.userId as string | undefined;
      if (!(await userCanAccessDm(conversationId, userId))) return;
      socket.join(roomName("dm", conversationId));
    });

    socket.on("leave_dm", (conversationId: string) => {
      if (!conversationId) return;
      socket.leave(roomName("dm", conversationId));
    });

    socket.on("send_dm_message", async (payload: unknown) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId) return;

      const parsed = socketDmMessageSchema.safeParse(payload);
      if (!parsed.success) return;

      try {
        await createDmMessage({
          conversationId: parsed.data.conversationId,
          userId,
          body: parsed.data.body,
          type: parsed.data.type,
          parentMessageId: parsed.data.parentMessageId,
        });
      } catch (err) {
        console.error("[socket send_dm_message]", err);
      }
    });

    socket.on("dm_typing_start", async (conversationId: string) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId) return;
      if (!(await userCanAccessDm(conversationId, userId))) return;
      const userName = await getTypingUserName(userId);
      broadcastToRoom(roomName("dm", conversationId), "dm_user_typing", {
        conversationId,
        userId,
        userName,
      });
    });

    socket.on("dm_typing_stop", async (conversationId: string) => {
      const userId = socket.data.userId as string | undefined;
      if (!(await userCanAccessDm(conversationId, userId))) return;
      broadcastToRoom(roomName("dm", conversationId), "dm_user_stopped_typing", {
        conversationId,
        userId,
      });
    });

    socket.on("dm_mark_read", async (conversationId: string) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId) return;
      try {
        await markDmMessagesRead(conversationId, userId);
      } catch (err) {
        console.error("[socket dm_mark_read]", err);
      }
    });

    socket.on("update_presence", async (status: string) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId) return;
      await markUserPresence(socket.id, userId, status).catch((err) =>
        console.error("[socket update_presence]", err)
      );
    });

    socket.on("disconnect", () => {
      forgetSocketPresence(socket.id).catch((err) =>
        console.error("[socket disconnect presence]", err)
      );
    });
  });
}
