import { User } from "../models/User";
import { PointEvent, PointEventType } from "../models/PointEvent";
import { Notification } from "../models/Notification";
import { broadcastToUser } from "./realtime";

const POINT_VALUES: Record<PointEventType, number> = {
  ANSWERED_QUESTION: 10,
  ANSWER_MARKED_SOLUTION: 25,
  RECEIVED_UPVOTE: 5,
  HELPED_IN_LIVE_SESSION: 15,
  FIRST_ANSWER_OF_DAY: 5,
};

async function emitNotification(userId: string, notif: { id: string; type: string; message: string; link: string; createdAt: Date }): Promise<void> {
  await broadcastToUser(userId, "notification", { ...notif, read: false });
}

async function checkAndAwardBadges(userId: string): Promise<void> {
  const user = await User.findById(userId).select("badges points");
  if (!user) return;

  const newBadges: string[] = [];

  if (!user.badges.includes("First Blood")) {
    const count = await PointEvent.countDocuments({ userId, eventType: "ANSWERED_QUESTION" });
    if (count === 1) newBadges.push("First Blood");
  }

  if (!user.badges.includes("Reliable")) {
    const count = await PointEvent.countDocuments({ userId, eventType: "ANSWER_MARKED_SOLUTION" });
    if (count >= 10) newBadges.push("Reliable");
  }

  if (!user.badges.includes("Top Expert") && user.points >= 500) {
    const rank = await User.countDocuments({ points: { $gt: user.points } });
    if (rank < 10) newBadges.push("Top Expert");
  }

  if (newBadges.length === 0) return;

  await User.findByIdAndUpdate(userId, { $addToSet: { badges: { $each: newBadges } } });

  for (const badge of newBadges) {
    const notif = await Notification.create({
      userId,
      type: "badge_earned",
      message: `You earned the "${badge}" badge!`,
      link: "/dashboard/profile",
      read: false,
    });
    await emitNotification(userId, {
      id: String(notif._id),
      type: notif.type,
      message: notif.message,
      link: notif.link,
      createdAt: notif.createdAt,
    });
  }
}

export async function awardPoints(
  userId: string,
  eventType: PointEventType,
  refId: string
): Promise<void> {
  const pts = POINT_VALUES[eventType];
  await PointEvent.create({ userId, eventType, points: pts, refId });
  await User.findByIdAndUpdate(userId, { $inc: { points: pts } });
  await checkAndAwardBadges(userId);
}
