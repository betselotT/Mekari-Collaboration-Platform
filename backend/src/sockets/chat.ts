import { Server, Socket } from "socket.io";
import { RedisClientType } from "redis";
import { z } from "zod";
import { createThreadMessage, markThreadMessagesRead, threadMessageSchema } from "../services/threadMessages";
import {
  broadcastToRoom,
  broadcastToUser,
  forgetSocketPresence,
  markUserPresence,
  rememberSocketUser,
  roomName,
} from "../services/realtime";
import {
  createDmMessage,
  dmMessageSchema,
  getConversationForUser,
  markDmMessagesRead,
  userCanAccessDm,
} from "../services/dmMessages";
import { User } from "../models/User";
import { ADMIN_DASHBOARD_ROOM } from "../services/adminRealtime";
import {
  addWhiteboardStroke,
  clearWhiteboard,
  undoWhiteboardStroke,
  userCanAccessWhiteboard,
  whiteboardClearSchema,
  whiteboardRoomName,
  whiteboardStrokeSchema,
} from "../services/whiteboards";
import { AUTH_SESSION_COOKIE, readCookie, verifySessionToken } from "../authSession";

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

async function authenticateSocket(socket: Socket) {
  const token = readCookie(socket.handshake.headers.cookie, AUTH_SESSION_COOKIE);
  if (!token) return null;

  try {
    const decoded = verifySessionToken(token) as SocketAuth & { exp?: number };
    if (!decoded.sub) return null;
    const user = await User.findById(decoded.sub).select("role isBanned").lean();
    if (!user || user.isBanned) return null;
    socket.data.userId = decoded.sub;
    socket.data.userRole = user.role;
    socket.join(roomName("user", decoded.sub));
    rememberSocketUser(socket.id, decoded.sub);
    if (decoded.exp) {
      const expiresInMs = Math.max(0, decoded.exp * 1000 - Date.now());
      setTimeout(() => {
        socket.emit("session_expired");
        socket.disconnect(true);
      }, expiresInMs);
    }
    return decoded.sub;
  } catch {
    return null;
  }
}

function canJoinAdminDashboard(socket: Socket) {
  const expectedKey = process.env.ADMIN_API_KEY?.trim();
  if (!expectedKey) return false;

  const providedKey = socket.handshake.auth?.adminApiKey;
  return typeof providedKey === "string" && providedKey === expectedKey;
}

export function registerChatHandlers(
  io: Server,
  _redis?: RedisClientType<any, any, any> | null
) {
  io.on("connection", async (socket: Socket) => {
    const connectedUserId = await authenticateSocket(socket);
    const adminDashboardAllowed = canJoinAdminDashboard(socket);
    if (!connectedUserId && !adminDashboardAllowed) {
      socket.disconnect(true);
      return;
    }

    if (connectedUserId) {
      markUserPresence(socket.id, connectedUserId, "online").catch((err) =>
        console.error("[socket presence online]", err)
      );
    }

    socket.on("join_room", (threadId: string) => {
      if (!connectedUserId || !threadId) return;
      socket.join(roomName("thread", threadId));
    });

    socket.on("leave_room", (threadId: string) => {
      if (!threadId) return;
      socket.leave(roomName("thread", threadId));
    });

    socket.on("join_admin_dashboard", () => {
      if (!adminDashboardAllowed) return;
      socket.join(ADMIN_DASHBOARD_ROOM);
    });

    socket.on("leave_admin_dashboard", () => {
      socket.leave(ADMIN_DASHBOARD_ROOM);
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
      socket.to(roomName("dm", conversationId)).emit("dm_user_typing", {
        conversationId,
        userId,
        userName,
      });
    });

    socket.on("dm_typing_stop", async (conversationId: string) => {
      const userId = socket.data.userId as string | undefined;
      if (!(await userCanAccessDm(conversationId, userId))) return;
      socket.to(roomName("dm", conversationId)).emit("dm_user_stopped_typing", {
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

    socket.on("open_dm_whiteboard", async (conversationId: string) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId) return;

      try {
        const conversation = await getConversationForUser(conversationId, userId);
        if (!conversation) return;

        const payload = {
          conversationId,
          roomId: `dm:${conversationId}`,
          openedBy: userId,
        };

        await Promise.all(
          conversation.participants
            .map((participantId) => String(participantId))
            .filter((participantId) => participantId !== userId)
            .map((participantId) =>
              broadcastToUser(participantId, "dm_whiteboard_opened", payload)
            )
        );
      } catch (err) {
        console.error("[socket open_dm_whiteboard]", err);
      }
    });

    socket.on("close_dm_whiteboard", async (conversationId: string) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId) return;

      try {
        const conversation = await getConversationForUser(conversationId, userId);
        if (!conversation) return;

        const payload = {
          conversationId,
          roomId: `dm:${conversationId}`,
          closedBy: userId,
        };

        await Promise.all(
          conversation.participants
            .map((participantId) => String(participantId))
            .filter((participantId) => participantId !== userId)
            .map((participantId) =>
              broadcastToUser(participantId, "dm_whiteboard_closed", payload)
            )
        );
      } catch (err) {
        console.error("[socket close_dm_whiteboard]", err);
      }
    });

    socket.on("join_whiteboard", async (roomId: string) => {
      const userId = socket.data.userId as string | undefined;
      if (!(await userCanAccessWhiteboard(roomId, userId))) return;
      socket.join(whiteboardRoomName(roomId));
    });

    socket.on("leave_whiteboard", (roomId: string) => {
      if (!roomId) return;
      socket.leave(whiteboardRoomName(roomId));
    });

    socket.on("whiteboard_stroke", async (payload: unknown) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId) return;

      const parsed = whiteboardStrokeSchema.safeParse(payload);
      if (!parsed.success) return;

      try {
        const stroke = await addWhiteboardStroke(parsed.data, userId);
        if (!stroke) return;
        broadcastToRoom(whiteboardRoomName(parsed.data.roomId), "whiteboard_stroke", {
          roomId: parsed.data.roomId,
          stroke,
        });
      } catch (err) {
        console.error("[socket whiteboard_stroke]", err);
      }
    });

    socket.on("whiteboard_clear", async (payload: unknown) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId) return;

      const parsed = whiteboardClearSchema.safeParse(payload);
      if (!parsed.success) return;

      try {
        const cleared = await clearWhiteboard(parsed.data.roomId, userId);
        if (!cleared) return;
        broadcastToRoom(whiteboardRoomName(parsed.data.roomId), "whiteboard_clear", {
          roomId: parsed.data.roomId,
        });
      } catch (err) {
        console.error("[socket whiteboard_clear]", err);
      }
    });

    socket.on("whiteboard_undo", async (payload: unknown) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId || typeof payload !== "object" || !payload) return;

      const { roomId, strokeId } = payload as { roomId?: string; strokeId?: string };
      if (!roomId || !strokeId) return;

      try {
        const removed = await undoWhiteboardStroke(roomId, strokeId, userId);
        if (!removed) return;
        broadcastToRoom(whiteboardRoomName(roomId), "whiteboard_undo", { roomId, strokeId });
      } catch (err) {
        console.error("[socket whiteboard_undo]", err);
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
