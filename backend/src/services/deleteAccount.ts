import { Types } from "mongoose";
import { AuditLog } from "../models/AuditLog";
import { BadgeEvent } from "../models/BadgeEvent";
import { CertificateEvent } from "../models/CertificateEvent";
import { DmConversation } from "../models/DmConversation";
import { ExpertReview } from "../models/ExpertReview";
import { FeedbackEvent } from "../models/FeedbackEvent";
import { KnowledgeDoc } from "../models/KnowledgeDoc";
import { MatchRequest } from "../models/MatchRequest";
import { Message } from "../models/Message";
import { Notification } from "../models/Notification";
import { PointEvent } from "../models/PointEvent";
import { Report } from "../models/Report";
import { Thread } from "../models/Thread";
import { User } from "../models/User";
import { Whiteboard } from "../models/Whiteboard";

export async function deleteUserAccount(userId: string) {
  const userObjectId = new Types.ObjectId(userId);
  const [conversations, ownedThreads] = await Promise.all([
    DmConversation.find({ participants: userObjectId }).select("_id").lean(),
    Thread.find({ createdBy: userObjectId }).select("_id").lean(),
  ]);
  const conversationIds = conversations.map((conversation) => conversation._id);
  const ownedThreadIds = ownedThreads.map((thread) => thread._id);
  const deletedMessages = await Message.find({
    $or: [
      { sender: userObjectId },
      { conversation: { $in: conversationIds } },
      { thread: { $in: ownedThreadIds } },
    ],
  })
    .select("_id")
    .lean();
  const deletedMessageIds = deletedMessages.map((message) => message._id);
  const deletedReferenceIds = [
    userObjectId,
    ...conversationIds,
    ...ownedThreadIds,
    ...deletedMessageIds,
  ];

  await Promise.all([
    Whiteboard.deleteMany({
      roomId: { $in: conversationIds.map((id) => `dm:${id}`) },
    }),
    KnowledgeDoc.deleteMany({ questionId: { $in: ownedThreadIds } }),
    MatchRequest.deleteMany({
      $or: [{ requester: userObjectId }, { thread: { $in: ownedThreadIds } }],
    }),
    FeedbackEvent.deleteMany({
      $or: [
        { userId: userObjectId },
        { targetId: { $in: deletedReferenceIds } },
        { threadId: { $in: ownedThreadIds } },
      ],
    }),
    Report.deleteMany({
      $or: [
        { reporterId: userObjectId },
        { targetType: "user", targetId: userObjectId },
        { targetType: "thread", targetId: { $in: ownedThreadIds } },
        { targetType: "message", targetId: { $in: deletedMessageIds } },
      ],
    }),
    PointEvent.deleteMany({
      $or: [{ userId: userObjectId }, { refId: { $in: deletedReferenceIds } }],
    }),
    BadgeEvent.deleteMany({
      $or: [{ userId: userObjectId }, { refId: { $in: deletedReferenceIds } }],
    }),
    CertificateEvent.deleteMany({ userId: userObjectId }),
    Notification.deleteMany({ userId: userObjectId }),
    ExpertReview.deleteMany({
      $or: [{ expert: userObjectId }, { reviewer: userObjectId }],
    }),
    AuditLog.deleteMany({
      $or: [
        { actorId: userObjectId },
        { targetId: { $in: deletedReferenceIds.map(String) } },
      ],
    }),
  ]);

  await Promise.all([
    Message.deleteMany({ _id: { $in: deletedMessageIds } }),
    DmConversation.deleteMany({ _id: { $in: conversationIds } }),
    Thread.deleteMany({ _id: { $in: ownedThreadIds } }),
  ]);

  await Promise.all([
    Message.updateMany(
      {},
      {
        $pull: {
          readBy: { user: userObjectId },
          upvotes: userObjectId,
        },
      }
    ),
    Message.updateMany(
      { parentMessageId: { $in: deletedMessageIds } },
      { $unset: { parentMessageId: "" } }
    ),
    Thread.updateMany(
      {},
      {
        $pull: {
          participants: userObjectId,
          matchedExperts: userObjectId,
        },
      }
    ),
    Thread.updateMany(
      { solvedBy: userObjectId },
      { $unset: { solvedBy: "" } }
    ),
    Thread.updateMany(
      { solutionMsgId: { $in: deletedMessageIds } },
      { $unset: { solutionMsgId: "" } }
    ),
    MatchRequest.updateMany(
      {},
      { $pull: { recommendations: { expert: userObjectId } } }
    ),
    User.updateMany(
      { "expertVerification.reviewedBy": userObjectId },
      { $unset: { "expertVerification.reviewedBy": "" } }
    ),
  ]);

  return User.findByIdAndDelete(userObjectId);
}
