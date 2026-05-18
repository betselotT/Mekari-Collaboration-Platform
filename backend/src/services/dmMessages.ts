import mongoose from "mongoose";
import { z } from "zod";
import { DmConversation } from "../models/DmConversation";
import { Message, type MessageType } from "../models/Message";
import { User } from "../models/User";
import { awardPoints } from "./awardPoints";
import { createGoogleMeetSpace } from "./googleMeet";
import { createNotification } from "./notifications";
import { broadcastToRoom, broadcastToUser, roomName } from "./realtime";

export const createDmConversationSchema = z.object({
  expertId: z.string().min(1),
});

export const dmMessageSchema = z.object({
  body: z.string().trim().min(1),
  type: z.enum(["TEXT", "CODE", "IMAGE", "FILE", "SYSTEM_EVENT"]).optional(),
  attachmentUrl: z.string().max(7_000_000).optional(),
  parentMessageId: z.string().optional(),
});

export const endDmSessionSchema = z.object({
  helpDelivered: z.boolean().default(false),
});

const MIN_HELPFUL_LIVE_SESSION_MINUTES = Number(
  process.env.MIN_HELPFUL_LIVE_SESSION_MINUTES || 10
);
const MIN_HELPFUL_LIVE_SESSION_MS =
  Number.isFinite(MIN_HELPFUL_LIVE_SESSION_MINUTES) && MIN_HELPFUL_LIVE_SESSION_MINUTES > 0
    ? MIN_HELPFUL_LIVE_SESSION_MINUTES * 60 * 1000
    : 10 * 60 * 1000;

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

function serializeDmSession(conversation: Awaited<ReturnType<typeof getConversationForUser>>) {
  const session = conversation?.activeSession;
  if (!session) return null;

  return {
    meetLink: session.meetLink,
    meetSpaceName: session.meetSpaceName,
    status: session.status,
    startedBy: String(session.startedBy),
    startedAt: session.startedAt,
    endedBy: session.endedBy ? String(session.endedBy) : undefined,
    endedAt: session.endedAt,
  };
}

export async function createDmMessage(input: {
  conversationId: string;
  userId: string;
  body: string;
  type?: MessageType;
  attachmentUrl?: string;
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
    attachmentUrl: input.attachmentUrl,
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
    attachmentUrl: message.attachmentUrl,
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

export async function startDmSession(conversationId: string, userId: string) {
  const conversation = await getConversationForUser(conversationId, userId);
  if (!conversation) throw forbidden();

  if (conversation.activeSession?.status === "active") {
    return { session: serializeDmSession(conversation), alreadyActive: true };
  }

  if (conversation.activeSession?.status === "creating") {
    const error = new Error("A live session is already being created") as Error & { status?: number };
    error.status = 409;
    throw error;
  }

  const participantIds = conversation.participants.map((participantId) => String(participantId));
  const locked = await DmConversation.findOneAndUpdate(
    {
      _id: conversationId,
      participants: userId,
      $or: [
        { activeSession: { $exists: false } },
        { "activeSession.status": "ended" },
      ],
    },
    {
      $set: {
        activeSession: {
          meetLink: "creating",
          status: "creating",
          startedBy: userId,
          startedAt: new Date(),
        },
      },
    },
    { new: true }
  );

  if (!locked) {
    const existing = await getConversationForUser(conversationId, userId);
    return { session: serializeDmSession(existing), alreadyActive: true };
  }

  let created: { meetLink: string; meetSpaceName?: string };
  try {
    created = await createGoogleMeetSpace();
  } catch (err) {
    await DmConversation.findByIdAndUpdate(conversationId, { $unset: { activeSession: "" } });
    throw err;
  }

  conversation.activeSession = {
    meetLink: created.meetLink,
    meetSpaceName: created.meetSpaceName,
    status: "active",
    startedBy: new mongoose.Types.ObjectId(userId),
    startedAt: new Date(),
  };
  conversation.lastMessagePreview = "Live session started";
  conversation.lastMessageAt = new Date();
  await conversation.save();

  const systemMsg = await Message.create({
    conversation: conversationId,
    sender: userId,
    body: `Live session started. Join here: ${created.meetLink}`,
    type: "SYSTEM_EVENT",
  });

  const populatedMessage = await systemMsg.populate("sender", "name avatarUrl role");
  const messagePayload = {
    _id: systemMsg.id,
    id: systemMsg.id,
    conversation: conversationId,
    sender: populatedMessage.sender,
    body: systemMsg.body,
    type: systemMsg.type,
    parentMessageId: systemMsg.parentMessageId,
    createdAt: systemMsg.createdAt,
  };
  const session = serializeDmSession(conversation);

  await broadcastToRoom(roomName("dm", conversationId), "dm_session_updated", {
    conversationId,
    session,
    message: messagePayload,
  });
  await broadcastToRoom(roomName("dm", conversationId), "new_dm_message", messagePayload);
  for (const participantId of participantIds) {
    await broadcastToUser(participantId, "dm_conversation_updated", {
      conversationId,
      message: messagePayload,
      session,
    });
  }

  const sender = populatedMessage.sender as unknown as { name?: string };
  const senderName = sender?.name || "Someone";
  await Promise.all(
    participantIds
      .filter((participantId) => participantId !== String(userId))
      .map((participantId) =>
        createNotification({
          userId: participantId,
          category: "chat",
          type: "dm_session_started",
          title: "Live session started",
          message: `${senderName} started a Google Meet session in your DM.`,
          link: `/dashboard/messages?conversation=${conversationId}`,
        })
      )
  );

  return { session, message: populatedMessage, alreadyActive: false };
}

export async function getActiveDmSession(conversationId: string, userId: string) {
  const conversation = await getConversationForUser(conversationId, userId);
  if (!conversation) throw forbidden();

  if (!conversation.activeSession || conversation.activeSession.status !== "active") {
    const error = new Error("No active session to join") as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  return serializeDmSession(conversation);
}

export async function endDmSession(
  conversationId: string,
  userId: string,
  options: z.infer<typeof endDmSessionSchema> = { helpDelivered: false }
) {
  const conversation = await getConversationForUser(conversationId, userId);
  if (!conversation) throw forbidden();

  if (!conversation.activeSession || conversation.activeSession.status !== "active") {
    const error = new Error("No active session to end") as Error & { status?: number };
    error.status = 409;
    throw error;
  }

  const sessionStartedAt = new Date(conversation.activeSession.startedAt);
  const sessionEndedAt = new Date();
  const durationMs = sessionEndedAt.getTime() - sessionStartedAt.getTime();
  const helpConfirmed = options.helpDelivered;

  conversation.activeSession.status = "ended";
  conversation.activeSession.endedBy = new mongoose.Types.ObjectId(userId);
  conversation.activeSession.endedAt = sessionEndedAt;
  conversation.lastMessagePreview = "Live session ended";
  conversation.lastMessageAt = new Date();
  await conversation.save();

  const systemMsg = await Message.create({
    conversation: conversationId,
    sender: userId,
    body: "Live session ended.",
    type: "SYSTEM_EVENT",
  });

  const helpedInLiveSessionAwarded =
    helpConfirmed && durationMs >= MIN_HELPFUL_LIVE_SESSION_MS;
  let helpedInLiveSessionPoints:
    | { pointsAwarded: number; totalPoints: number; awardedToUserId: string }
    | null = null;
  if (helpedInLiveSessionAwarded) {
    const awarded = await awardPoints(
      String(conversation.expert),
      "HELPED_IN_LIVE_SESSION",
      String(systemMsg._id)
    );
    helpedInLiveSessionPoints = {
      ...awarded,
      awardedToUserId: String(conversation.expert),
    };
  }

  const populatedMessage = await systemMsg.populate("sender", "name avatarUrl role");
  const messagePayload = {
    _id: systemMsg.id,
    id: systemMsg.id,
    conversation: conversationId,
    sender: populatedMessage.sender,
    body: systemMsg.body,
    type: systemMsg.type,
    parentMessageId: systemMsg.parentMessageId,
    createdAt: systemMsg.createdAt,
  };
  const session = serializeDmSession(conversation);

  await broadcastToRoom(roomName("dm", conversationId), "dm_session_updated", {
    conversationId,
    session,
    message: messagePayload,
  });
  await broadcastToRoom(roomName("dm", conversationId), "new_dm_message", messagePayload);
  for (const participantId of conversation.participants) {
    await broadcastToUser(String(participantId), "dm_conversation_updated", {
      conversationId,
      message: messagePayload,
      session,
    });
  }

  return {
    session,
    message: populatedMessage,
    gamification: {
      helpedInLiveSessionAwarded,
      durationMs,
      minDurationMs: MIN_HELPFUL_LIVE_SESSION_MS,
      helpConfirmed,
      helpedInLiveSessionPoints,
    },
  };
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
