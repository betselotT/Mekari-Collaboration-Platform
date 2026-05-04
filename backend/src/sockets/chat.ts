import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { RedisClientType } from "redis";
import { Message } from "../models/Message";
import { Thread } from "../models/Thread";
import { User } from "../models/User";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// In-memory presence fallback (used when Redis is not configured)
const presenceMap = new Map<string, { lastSeen: number; status: string }>();
// socketId → userId, used to clean up on disconnect
const socketToUser = new Map<string, string>();

export function registerChatHandlers(
  io: Server,
  _redis?: RedisClientType<any, any, any> | null
) {
  // CRITICAL BEHAVIOR #3 — Presence heartbeat: check every 30 s, expire after 60 s
  setInterval(() => {
    const now = Date.now();
    presenceMap.forEach(async (data, userId) => {
      if (now - data.lastSeen > 60_000 && data.status !== "offline") {
        presenceMap.set(userId, { lastSeen: data.lastSeen, status: "offline" });
        try {
          await User.findByIdAndUpdate(userId, { $set: { availabilityStatus: "offline" } });
        } catch {}
        io.emit("presence_update", { userId, status: "offline" });
      }
    });
  }, 30_000);

  io.on("connection", (socket: Socket) => {
    const token = socket.handshake.auth?.token as string | undefined;
    let socketUserId: string | null = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
        socketUserId = decoded.sub;
        socket.data.userId = socketUserId;
        socketToUser.set(socket.id, socketUserId);

        // Join personal room for targeted notifications
        socket.join(`user:${socketUserId}`);

        // Mark online
        presenceMap.set(socketUserId, { lastSeen: Date.now(), status: "online" });
        User.findByIdAndUpdate(socketUserId, { $set: { availabilityStatus: "online" } }).catch(() => {});
        io.emit("presence_update", { userId: socketUserId, status: "online" });
      } catch {
        // Proceed without userId — read-only observer
      }
    }

    // ── join_room ──────────────────────────────────────────────────────────
    socket.on("join_room", (threadId: string) => {
      socket.join(`room:${threadId}`);
      socket.join(`thread:${threadId}`); // backward compat
    });

    // ── leave_room ─────────────────────────────────────────────────────────
    socket.on("leave_room", (threadId: string) => {
      socket.leave(`room:${threadId}`);
      socket.leave(`thread:${threadId}`);
    });

    // ── send_message ───────────────────────────────────────────────────────
    socket.on(
      "send_message",
      async (payload: { threadId: string; body: string; type?: string; parentMessageId?: string }) => {
        const userId = socket.data.userId as string | undefined;
        if (!userId) return;

        try {
          const message = await Message.create({
            thread: payload.threadId,
            sender: userId,
            body: payload.body,
            type: payload.type || "TEXT",
            parentMessageId: payload.parentMessageId || undefined,
            isFromAi: false,
          });

          await Thread.findByIdAndUpdate(payload.threadId, {
            $addToSet: { participants: userId },
            $set: { updatedAt: new Date() },
          });

          const populated = await message.populate("sender", "name avatarUrl");

          io.to(`room:${payload.threadId}`).emit("new_message", {
            id: message.id,
            thread: payload.threadId,
            sender: populated.sender,
            body: message.body,
            type: message.type,
            parentMessageId: message.parentMessageId,
            upvotes: [],
            isFromAi: false,
            createdAt: message.createdAt,
          });
        } catch (err) {
          console.error("[socket send_message]", err);
        }
      }
    );

    // ── typing_start ───────────────────────────────────────────────────────
    socket.on("typing_start", (threadId: string) => {
      const userId = socket.data.userId;
      if (!userId) return;
      socket.to(`room:${threadId}`).emit("user_typing", { userId, threadId });
    });

    // ── typing_stop ────────────────────────────────────────────────────────
    socket.on("typing_stop", (threadId: string) => {
      const userId = socket.data.userId;
      if (!userId) return;
      socket.to(`room:${threadId}`).emit("user_stopped_typing", { userId, threadId });
    });

    // ── update_presence (heartbeat) ────────────────────────────────────────
    socket.on("update_presence", async (status: string) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId) return;

      const validStatuses = ["online", "busy", "offline", "in_session"];
      const safeStatus = validStatuses.includes(status) ? status : "online";

      presenceMap.set(userId, { lastSeen: Date.now(), status: safeStatus });

      try {
        await User.findByIdAndUpdate(userId, { $set: { availabilityStatus: safeStatus } });
      } catch {}

      io.emit("presence_update", { userId, status: safeStatus });
    });

    // ── backward-compat: join-thread / send-message (kebab) ───────────────
    socket.on("join-thread", (threadId: string) => {
      socket.join(`thread:${threadId}`);
      socket.join(`room:${threadId}`);
    });

    socket.on(
      "send-message",
      async (payload: { threadId: string; senderId: string; body: string }) => {
        try {
          const message = await Message.create({
            thread: payload.threadId,
            sender: payload.senderId,
            body: payload.body,
            isFromAi: false,
          });

          await Thread.findByIdAndUpdate(payload.threadId, {
            $set: { updatedAt: new Date() },
          });

          io.to(`thread:${payload.threadId}`).emit("new-message", {
            id: message.id,
            thread: message.thread,
            sender: message.sender,
            body: message.body,
            createdAt: message.createdAt,
          });
        } catch (err) {
          console.error("[socket send-message]", err);
        }
      }
    );

    // ── disconnect ─────────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      const userId = socketToUser.get(socket.id);
      socketToUser.delete(socket.id);
      if (!userId) return;

      // Only mark offline when this was the user's last socket connection
      const userSockets = await io.in(`user:${userId}`).fetchSockets();
      if (userSockets.length === 0) {
        presenceMap.set(userId, { lastSeen: Date.now(), status: "offline" });
        try {
          await User.findByIdAndUpdate(userId, { $set: { availabilityStatus: "offline" } });
        } catch {}
        io.emit("presence_update", { userId, status: "offline" });
      }
    });
  });
}
