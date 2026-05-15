import { z } from "zod";
import { Message } from "../models/Message";
import { Thread } from "../models/Thread";
import { PointEvent } from "../models/PointEvent";
import { awardPoints } from "./awardPoints";
import { broadcastToRoom, roomName } from "./realtime";

export const threadMessageSchema = z.object({
  body: z.string().trim().min(1),
  type: z.enum(["TEXT", "CODE", "IMAGE", "FILE", "SYSTEM_EVENT"]).optional(),
  parentMessageId: z.string().optional(),
});

type ThreadMessageInput = {
  threadId: string;
  userId: string;
  body: string;
  type?: "TEXT" | "CODE" | "IMAGE" | "FILE" | "SYSTEM_EVENT";
  parentMessageId?: string;
  broadcast?: boolean;
};

export async function createThreadMessage(input: ThreadMessageInput) {
  const thread = await Thread.findById(input.threadId);
  if (!thread) {
    const error = new Error("Thread not found") as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  const message = await Message.create({
    thread: input.threadId,
    sender: input.userId,
    body: input.body,
    type: input.type || "TEXT",
    parentMessageId: input.parentMessageId || undefined,
    isFromAi: false,
  });

  await Thread.findByIdAndUpdate(input.threadId, {
    $addToSet: { participants: input.userId },
    $set: { updatedAt: new Date() },
  });

  const populated = await message.populate("sender", "name avatarUrl");
  const payload = {
    _id: message.id,
    id: message.id,
    thread: input.threadId,
    sender: populated.sender,
    body: message.body,
    type: message.type,
    parentMessageId: message.parentMessageId,
    upvotes: [],
    isFromAi: false,
    createdAt: message.createdAt,
  };

  if (input.broadcast !== false) {
    await broadcastToRoom(roomName("thread", input.threadId), "new_message", payload);
  }

  if (String(thread.createdBy) !== String(input.userId)) {
    await awardPoints(String(input.userId), "ANSWERED_QUESTION", String(message._id));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayAnswers = await PointEvent.countDocuments({
      userId: input.userId,
      eventType: "ANSWERED_QUESTION",
      createdAt: { $gte: todayStart },
    });
    if (todayAnswers === 1) {
      await awardPoints(String(input.userId), "FIRST_ANSWER_OF_DAY", String(message._id));
    }
  }

  return { message: populated, payload, thread };
}
