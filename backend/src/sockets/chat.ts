import { Server } from "socket.io";
import { RedisClientType } from "redis";
import { Message } from "../models/Message";
import { Thread } from "../models/Thread";

export function registerChatHandlers(io: Server, _redis: RedisClientType) {
  io.on("connection", (socket) => {
    socket.on("join-thread", (threadId: string) => {
      socket.join(`thread:${threadId}`);
    });

    socket.on(
      "send-message",
      async (payload: { threadId: string; senderId: string; body: string }) => {
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
      }
    );
  });
}

