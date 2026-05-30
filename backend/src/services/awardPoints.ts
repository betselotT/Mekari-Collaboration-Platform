import { Types } from "mongoose";
import { User } from "../models/User";
import { PointEvent, PointEventType } from "../models/PointEvent";
import { Notification } from "../models/Notification";
import { BadgeEvent, BadgeRefType } from "../models/BadgeEvent";
import { CertificateEvent } from "../models/CertificateEvent";
import { broadcastToUser } from "./realtime";

export const POINT_VALUES: Record<PointEventType, number> = {
  ANSWERED_QUESTION: 5,
  ANSWER_MARKED_SOLUTION: 20,
  RECEIVED_UPVOTE: 15,
  HELPED_IN_LIVE_SESSION: 25,
  FIRST_ANSWER_OF_DAY: 10,
};

export type BadgeAchievementResponse = {
  badge: string;
  refId?: Types.ObjectId;
  refType?: BadgeRefType;
  earnedAt: Date;
};

export type CertificateResponse = {
  certificateId: string;
  title: string;
  description: string;
  milestone: string;
  issuedAt: Date;
  refId?: string;
};

export type AchievementSummary = {
  badges: string[];
  badgeCounts: Record<string, number>;
  badgeAchievements: BadgeAchievementResponse[];
  certificates: CertificateResponse[];
};

export function emptyAchievementSummary(): AchievementSummary {
  return {
    badges: [],
    badgeCounts: {},
    badgeAchievements: [],
    certificates: [],
  };
}

function buildBadgeSummary(events: Array<{ badge: string; refId?: Types.ObjectId; refType?: BadgeRefType; earnedAt: Date }>) {
  const badgeCounts: Record<string, number> = {};
  const badges: string[] = [];

  for (const event of events) {
    badgeCounts[event.badge] = (badgeCounts[event.badge] || 0) + 1;
    if (!badges.includes(event.badge)) badges.push(event.badge);
  }

  return {
    badges,
    badgeCounts,
    badgeAchievements: events.map((event) => ({
      badge: event.badge,
      refId: event.refId,
      refType: event.refType,
      earnedAt: event.earnedAt,
    })),
  };
}

export async function getAchievementSummary(userId: string): Promise<AchievementSummary> {
  const [badgeEvents, certificateEvents] = await Promise.all([
    BadgeEvent.find({ userId }).sort({ earnedAt: -1 }).lean(),
    CertificateEvent.find({ userId }).sort({ issuedAt: -1 }).lean(),
  ]);
  const badgeSummary = buildBadgeSummary(badgeEvents);

  return {
    ...badgeSummary,
    certificates: certificateEvents.map((certificate) => ({
      certificateId: certificate.certificateId,
      title: certificate.title,
      description: certificate.description,
      milestone: certificate.milestone,
      issuedAt: certificate.issuedAt,
      refId: certificate.refId,
    })),
  };
}

export async function getAchievementSummaries(userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) return new Map<string, AchievementSummary>();

  const objectIds = uniqueUserIds
    .filter((userId) => Types.ObjectId.isValid(userId))
    .map((userId) => new Types.ObjectId(userId));

  const [badgeEvents, certificateEvents] = await Promise.all([
    BadgeEvent.find({ userId: { $in: objectIds } }).sort({ earnedAt: -1 }).lean(),
    CertificateEvent.find({ userId: { $in: objectIds } }).sort({ issuedAt: -1 }).lean(),
  ]);

  const summaries = new Map<string, AchievementSummary>();
  for (const userId of uniqueUserIds) {
    summaries.set(userId, emptyAchievementSummary());
  }

  for (const [userId, events] of Object.entries(
    badgeEvents.reduce<Record<string, typeof badgeEvents>>((acc, event) => {
      const key = String(event.userId);
      acc[key] = acc[key] || [];
      acc[key].push(event);
      return acc;
    }, {})
  )) {
    summaries.set(userId, {
      ...(summaries.get(userId) || emptyAchievementSummary()),
      ...buildBadgeSummary(events),
    });
  }

  for (const certificate of certificateEvents) {
    const userId = String(certificate.userId);
    const summary = summaries.get(userId) || emptyAchievementSummary();
    summary.certificates.push({
      certificateId: certificate.certificateId,
      title: certificate.title,
      description: certificate.description,
      milestone: certificate.milestone,
      issuedAt: certificate.issuedAt,
      refId: certificate.refId,
    });
    summaries.set(userId, summary);
  }

  return summaries;
}

export async function withAchievementSummary<T extends { _id?: unknown; id?: unknown }>(user: T) {
  const userId = String(user._id || user.id || "");
  return {
    ...user,
    ...(userId ? await getAchievementSummary(userId) : emptyAchievementSummary()),
  };
}

export async function withAchievementSummaries<T extends { _id?: unknown; id?: unknown }>(users: T[]) {
  const summaries = await getAchievementSummaries(users.map((user) => String(user._id || user.id || "")));
  return users.map((user) => ({
    ...user,
    ...(summaries.get(String(user._id || user.id || "")) || emptyAchievementSummary()),
  }));
}

async function emitNotification(userId: string, notif: { id: string; type: string; message: string; link: string; createdAt: Date }): Promise<void> {
  await broadcastToUser(userId, "notification", { ...notif, read: false });
}

async function checkAndAwardBadges(userId: string): Promise<void> {
  const user = await User.findById(userId).select("points role");
  if (!user) return;

  const newBadges: string[] = [];

  if (!(await BadgeEvent.exists({ userId, badge: "First Blood" }))) {
    const count = await PointEvent.countDocuments({ userId, eventType: "ANSWERED_QUESTION" });
    if (count === 1) newBadges.push("First Blood");
  }

  if (!(await BadgeEvent.exists({ userId, badge: "Reliable" }))) {
    const count = await PointEvent.countDocuments({ userId, eventType: "ANSWER_MARKED_SOLUTION" });
    if (count >= 10) newBadges.push("Reliable");
  }

  if (!(await BadgeEvent.exists({ userId, badge: "Top Expert" })) && user.role === "expert" && user.points >= 500) {
    const rank = await User.countDocuments({ role: "expert", points: { $gt: user.points } });
    if (rank < 10) newBadges.push("Top Expert");
  }

  if (newBadges.length === 0) return;

  for (const badge of newBadges) {
    await BadgeEvent.create({
      userId,
      badge,
      refType: "point_event",
      earnedAt: new Date(),
    });
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
  const existing = await CertificateEvent.exists({ userId, certificateId: certificate.certificateId });
  if (existing) return false;

  await CertificateEvent.create({
    userId,
    ...certificate,
    issuedAt: new Date(),
  });

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
  const existingAchievement = await BadgeEvent.exists({ userId, badge, refId: refObjectId });

  if (!existingAchievement) {
    await BadgeEvent.create({
      userId,
      badge,
      refId: refObjectId,
      refType: "thread",
      earnedAt: new Date(),
    });
    if (badge === "Speed Demon") {
      await issueCertificateIfMissing(userId, {
        certificateId: "fast-responder",
        title: "Fast Responder",
        description: "Awarded for delivering a solution within five minutes.",
        milestone: "Solved a thread in under five minutes",
        refId,
      });
    }
    const count = await BadgeEvent.countDocuments({ userId, badge });
    return { awarded: true, count };
  }

  const count = await BadgeEvent.countDocuments({ userId, badge });
  return { awarded: false, count };
}
