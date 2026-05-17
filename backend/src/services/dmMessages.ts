import mongoose from "mongoose";
import { z } from "zod";
import { DmConversation } from "../models/DmConversation";
import { Message, type MessageType } from "../models/Message";
import { User } from "../models/User";
import { createNotification } from "./notifications";
import { broadcastToRoom, broadcastToUser, roomName } from "./realtime";

export const createDmConversationSchema = z.object({
  expertId: z.string().min(1),
});

export const dmMessageSchema = z.object({
  body: z.string().trim().min(1),
  type: z.enum(["TEXT", "CODE", "IMAGE", "FILE", "SYSTEM_EVENT"]).optional(),
  parentMessageId: z.string().optional(),
});

function participantKey(userIdA: string, userIdB: string) {
  return [String(userIdA), String(userIdB)].sort().join(":");
}

function forbidden(message = "You do not have access to this conversation") {
  const error = new Error(message) as Error & { status?: number };
  error.status = 403;
  return error;
}

export async function getConversationForUser(conversationId: string, userId: string) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) return null;
  return DmConversation.findOne({ _id: conversationId, participants: userId });
}

export async function userCanAccessDm(conversationId: string, userId?: string) {
  if (!userId || !mongoose.Types.ObjectId.isValid(conversationId)) return false;
  return !!(await DmConversation.exists({ _id: conversationId, participants: userId }));
}

export async function findOrCreateDmConversation(learnerId: string, expertId: string) {
  if (String(learnerId) === String(expertId)) {
    const error = new Error("You cannot start a DM with yourself") as Error & { status?: number };
    error.status = 400;
    throw error;
  }

  const expert = await User.findOne({ _id: expertId, role: "expert" });
  if (!expert) {
    const error = new Error("Expert not found") as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  const key = participantKey(learnerId, expertId);
  const conversation = await DmConversation.findOneAndUpdate(
    { participantKey: key },
    {
      $setOnInsert: {
        participants: [learnerId, expertId],
        learner: learnerId,
        expert: expertId,
        participantKey: key,
      },
    },
    { new: true, upsert: true }
  )
    .populate("participants", "name avatarUrl role availabilityStatus")
    .populate("learner", "name avatarUrl role availabilityStatus")
    .populate("expert", "name avatarUrl role availabilityStatus");

  return conversation;
}

export async function listDmConversations(userId: string) {
  return DmConversation.find({ participants: userId })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .populate("participants", "name avatarUrl role availabilityStatus")
    .populate("learner", "name avatarUrl role availabilityStatus")
    .populate("expert", "name avatarUrl role availabilityStatus");
}

export async function listDmMessages(conversationId: string, userId: string) {
  const conversation = await getConversationForUser(conversationId, userId);
  if (!conversation) throw forbidden();

  return Message.find({ conversation: conversationId })
    .sort({ createdAt: 1 })
    .populate("sender", "name avatarUrl role");
}

export async function createDmMessage(input: {
  conversationId: string;
  userId: string;
  body: string;
  type?: MessageType;
  parentMessageId?: string;
}) {
  const conversation = await getConversationForUser(input.conversationId, input.userId);
  if (!conversation) throw forbidden();

  if (input.parentMessageId) {
    const parent = await Message.exists({
      _id: input.parentMessageId,
      conversation: input.conversationId,
    });
    if (!parent) {
      const error = new Error("Reply target not found") as Error & { status?: number };
      error.status = 404;
      throw error;
    }
  }

  const message = await Message.create({
    conversation: input.conversationId,
    sender: input.userId,
    body: input.body,
    type: input.type || "TEXT",
    parentMessageId: input.parentMessageId || undefined,
  });

  await DmConversation.findByIdAndUpdate(input.conversationId, {
    $set: {
      lastMessagePreview: input.body.slice(0, 160),
      lastMessageAt: message.createdAt,
      updatedAt: new Date(),
    },
  });

  const populated = await message.populate("sender", "name avatarUrl role");
  const payload = {
    _id: message.id,
    id: message.id,
    conversation: input.conversationId,
    sender: populated.sender,
    body: message.body,
    type: message.type,
    parentMessageId: message.parentMessageId,
    createdAt: message.createdAt,
  };

  await broadcastToRoom(roomName("dm", input.conversationId), "new_dm_message", payload);
  for (const participantId of conversation.participants) {
    await broadcastToUser(String(participantId), "dm_conversation_updated", {
      conversationId: input.conversationId,
      message: payload,
    });
  }

  const sender = populated.sender as unknown as { name?: string };
  const senderName = sender?.name || "Someone";
  await Promise.all(
    conversation.participants
      .filter((participantId) => String(participantId) !== String(input.userId))
      .map((participantId) =>
        createNotification({
          userId: String(participantId),
          category: "chat",
          type: "new_dm_message",
          title: "New message",
          message: `${senderName}: ${input.body.slice(0, 120)}`,
          link: `/dashboard/messages?conversation=${input.conversationId}`,
        })
      )
  );

  return { message: populated, payload };
}

export async function deleteDmMessage(conversationId: string, messageId: string, userId: string) {
  const conversation = await getConversationForUser(conversationId, userId);
  if (!conversation) throw forbidden();

  const message = await Message.findOne({ _id: messageId, conversation: conversationId });
  if (!message) {
    const error = new Error("Message not found") as Error & { status?: number };
    error.status = 404;
    throw error;
  }
  if (String(message.sender) !== String(userId)) throw forbidden("You can only delete your own messages");

  await Message.findByIdAndDelete(message._id);
  const latest = await Message.findOne({ conversation: conversationId }).sort({ createdAt: -1 });
  await DmConversation.findByIdAndUpdate(conversationId, {
    $set: {
      lastMessagePreview: latest?.body || "",
      lastMessageAt: latest?.createdAt,
      updatedAt: new Date(),
    },
  });

  const payload = { conversationId, messageId, deletedBy: userId };
  await broadcastToRoom(roomName("dm", conversationId), "dm_message_deleted", payload);
  for (const participantId of conversation.participants) {
    await broadcastToUser(String(participantId), "dm_conversation_updated", {
      conversationId,
      deletedMessageId: messageId,
    });
  }

  return payload;
}
