import { Types } from "mongoose";
import { User } from "../models/User";
import { PointEvent, PointEventType } from "../models/PointEvent";
import { Notification } from "../models/Notification";
import { broadcastToUser } from "./realtime";

export const POINT_VALUES: Record<PointEventType, number> = {
  ANSWERED_QUESTION: 5,
  ANSWER_MARKED_SOLUTION: 20,
  RECEIVED_UPVOTE: 15,
  HELPED_IN_LIVE_SESSION: 25,
  FIRST_ANSWER_OF_DAY: 10,
};

export function normalizeBadgeCounts(input: {
  badges?: string[];
  badgeCounts?: Map<string, number> | Record<string, number> | null;
}): Record<string, number> {
  const counts: Record<string, number> = {};
  const rawCounts = input.badgeCounts;

  if (rawCounts instanceof Map) {
    for (const [badge, count] of rawCounts.entries()) {
      counts[badge] = count;
    }
  } else if (rawCounts && typeof rawCounts === "object") {
    for (const [badge, count] of Object.entries(rawCounts)) {
      counts[badge] = Number(count) || 0;
    }
  }

  for (const badge of input.badges || []) {
    counts[badge] = Math.max(counts[badge] || 0, 1);
  }

  return counts;
}

async function emitNotification(userId: string, notif: { id: string; type: string; message: string; link: string; createdAt: Date }): Promise<void> {
  await broadcastToUser(userId, "notification", { ...notif, read: false });
}

async function checkAndAwardBadges(userId: string): Promise<void> {
  const user = await User.findById(userId).select("badges points role");
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

  if (!user.badges.includes("Top Expert") && user.role === "expert" && user.points >= 500) {
    const rank = await User.countDocuments({ role: "expert", points: { $gt: user.points } });
    if (rank < 10) newBadges.push("Top Expert");
  }

  if (newBadges.length === 0) return;

  const badgeCountDefaults = Object.fromEntries(
    newBadges.map((badge) => [`badgeCounts.${badge}`, 1])
  );

  await User.findByIdAndUpdate(userId, {
    $addToSet: { badges: { $each: newBadges } },
    $max: badgeCountDefaults,
  });

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

async function issueCertificateIfMissing(
  userId: string,
  certificate: {
    certificateId: string;
    title: string;
    description: string;
    milestone: string;
    refId?: string;
  }
) {
  const issued = await User.findOneAndUpdate(
    {
      _id: userId,
      "certificates.certificateId": { $ne: certificate.certificateId },
    },
    {
      $push: {
        certificates: {
          ...certificate,
          issuedAt: new Date(),
        },
      },
    },
    { new: true }
  ).select("_id");

  if (!issued) return false;

  const notif = await Notification.create({
    userId,
    type: "certificate_earned",
    message: `You earned the "${certificate.title}" certificate!`,
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
  return true;
}

async function checkAndAwardCertificates(userId: string): Promise<void> {
  const user = await User.findById(userId).select("points role");
  if (!user) return;

  const solutionCount = await PointEvent.countDocuments({
    userId,
    eventType: "ANSWER_MARKED_SOLUTION",
  });
  if (solutionCount >= 100) {
    await issueCertificateIfMissing(userId, {
      certificateId: "100-solutions",
      title: "100 Solutions",
      description: "Awarded for having 100 answers marked as accepted solutions.",
      milestone: "100 accepted solutions",
    });
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const nextMonthStart = new Date(monthStart);
  nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);
  const monthKey = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthlyPoints = await PointEvent.aggregate<{ _id: string; points: number }>([
    {
      $match: {
        userId: new Types.ObjectId(userId),
        createdAt: { $gte: monthStart, $lt: nextMonthStart },
      },
    },
    { $group: { _id: "$userId", points: { $sum: "$points" } } },
  ]);
  const currentMonthlyPoints = monthlyPoints[0]?.points || 0;
  if (currentMonthlyPoints >= 100) {
    const higherScoringUsers = await PointEvent.aggregate<{ _id: Types.ObjectId; points: number }>([
      {
        $match: {
          createdAt: { $gte: monthStart, $lt: nextMonthStart },
        },
      },
      { $group: { _id: "$userId", points: { $sum: "$points" } } },
      { $match: { points: { $gt: currentMonthlyPoints } } },
      { $limit: 1 },
    ]);

    if (higherScoringUsers.length === 0) {
      await issueCertificateIfMissing(userId, {
        certificateId: `top-helper-${monthKey}`,
        title: "Top Helper of the Month",
        description: `Awarded for leading monthly helper activity in ${monthKey}.`,
        milestone: "Monthly top helper",
        refId: monthKey,
      });
    }
  }
}

export async function awardPoints(
  userId: string,
  eventType: PointEventType,
  refId: string
): Promise<{ pointsAwarded: number; totalPoints: number }> {
  const pts = POINT_VALUES[eventType];
  await PointEvent.create({ userId, eventType, points: pts, refId });
  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { points: pts } },
    { new: true }
  ).select("points");
  if (!updated) {
    const error = new Error("Point recipient not found") as Error & { status?: number };
    error.status = 404;
    throw error;
  }
  await checkAndAwardBadges(userId);
  await checkAndAwardCertificates(userId);
  return { pointsAwarded: pts, totalPoints: updated.points };
}

export async function awardRepeatableBadge(
  userId: string,
  badge: string,
  refId: string
): Promise<{ awarded: boolean; count: number }> {
  if (!Types.ObjectId.isValid(refId)) {
    const error = new Error("Invalid badge achievement reference") as Error & { status?: number };
    error.status = 400;
    throw error;
  }

  const refObjectId = new Types.ObjectId(refId);
  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      badgeAchievements: {
        $not: { $elemMatch: { badge, refId: refObjectId } },
      },
    },
    {
      $addToSet: { badges: badge },
      $inc: { [`badgeCounts.${badge}`]: 1 },
      $push: {
        badgeAchievements: {
          badge,
          refId: refObjectId,
          earnedAt: new Date(),
        },
      },
    },
    { new: true }
  ).select("badgeCounts");

  if (updated) {
    if (badge === "Speed Demon") {
      await issueCertificateIfMissing(userId, {
        certificateId: "fast-responder",
        title: "Fast Responder",
        description: "Awarded for delivering a solution within five minutes.",
        milestone: "Solved a thread in under five minutes",
        refId,
      });
    }
    return { awarded: true, count: updated.badgeCounts?.get(badge) || 0 };
  }

  const existing = await User.findById(userId).select("badgeCounts");
  return { awarded: false, count: existing?.badgeCounts?.get(badge) || 0 };
}
