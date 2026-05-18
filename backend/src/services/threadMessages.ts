import { z } from "zod";
import { Message } from "../models/Message";
import { Thread } from "../models/Thread";
import { PointEvent } from "../models/PointEvent";
import { awardPoints } from "./awardPoints";
import { createNotification } from "./notifications";
import { broadcastToRoom, roomName } from "./realtime";
import { generateContentTags } from "./tagExtraction";

export const threadMessageSchema = z.object({
  body: z.string().trim().min(1),
  type: z.enum(["TEXT", "CODE", "IMAGE", "FILE", "SYSTEM_EVENT"]).optional(),
  attachmentUrl: z.string().max(7_000_000).optional(),
  parentMessageId: z.string().optional(),
});

type ThreadMessageInput = {
  threadId: string;
  userId: string;
  body: string;
  type?: "TEXT" | "CODE" | "IMAGE" | "FILE" | "SYSTEM_EVENT";
  attachmentUrl?: string;
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
    attachmentUrl: input.attachmentUrl,
    parentMessageId: input.parentMessageId || undefined,
    isFromAi: false,
  });

  const generatedTags =
    message.type === "TEXT" || message.type === "CODE"
      ? await generateContentTags({
          title: thread.title,
          subject: thread.subject,
          body: input.body,
          existingTags: thread.tags,
        })
      : thread.tags;
  const addedTags = generatedTags.filter((tag) => !thread.tags.includes(tag));

  await Thread.findByIdAndUpdate(input.threadId, {
    $addToSet: { participants: input.userId },
    $set: { updatedAt: new Date(), tags: generatedTags },
  });

  if (addedTags.length > 0) {
    await broadcastToRoom(roomName("thread", input.threadId), "thread_tags_updated", {
      threadId: input.threadId,
      tags: generatedTags,
      addedTags,
    });
  }

  const populated = await message.populate("sender", "name avatarUrl");
  const payload = {
    _id: message.id,
    id: message.id,
    thread: input.threadId,
    sender: populated.sender,
    body: message.body,
    type: message.type,
    attachmentUrl: message.attachmentUrl,
    parentMessageId: message.parentMessageId,
    upvotes: [],
    isFromAi: false,
    createdAt: message.createdAt,
  };

  if (input.broadcast !== false) {
    await broadcastToRoom(roomName("thread", input.threadId), "new_message", payload);
  }

  const notifyIds = new Set<string>([
    String(thread.createdBy),
    ...thread.participants.map((participantId) => String(participantId)),
    ...thread.matchedExperts.map((expertId) => String(expertId)),
  ]);
  notifyIds.delete(String(input.userId));

  const sender = populated.sender as unknown as { name?: string };
  const senderName = sender?.name || "Someone";
  await Promise.all(
    Array.from(notifyIds).map((userId) =>
      createNotification({
        userId,
        category: "chat",
        type: "new_thread_message",
        title: "New thread message",
        message: `${senderName} replied in "${thread.title}"`,
        link: `/dashboard/threads/${input.threadId}`,
      })
    )
  );

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
