import { User, ExpertiseArea, IUser } from "../models/User";
import { MatchAvailabilityPreference } from "../models/MatchRequest";

const PROFICIENCY_WEIGHT: Record<ExpertiseArea["proficiency"], number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

function availabilityFactor(status: IUser["availabilityStatus"]) {
  if (status === "online") return 1;
  if (status === "busy") return 0.6;
  return 0;
}

function allowedByAvailabilityPreference(
  status: IUser["availabilityStatus"],
  pref: MatchAvailabilityPreference
) {
  if (pref === "any") return true;
  if (pref === "online_or_busy") return status === "online" || status === "busy";
  return status === "online";
}

function normalizePoints(points: number) {
  // Cap to keep outliers from dominating
  const capped = Math.max(0, Math.min(points, 1000));
  return capped / 1000;
}

export type ExpertRecommendation = {
  expertId: string;
  score: number;
  reasons: string[];
};

export async function recommendExperts(params: {
  requesterId?: string;
  subject: string;
  tags: string[];
  availabilityPreference: MatchAvailabilityPreference;
  limit?: number;
}): Promise<ExpertRecommendation[]> {
  const { requesterId, subject, tags, availabilityPreference, limit = 5 } = params;
  const tagSet = new Set([subject, ...tags].map((t) => t.trim()).filter(Boolean));
  const tagList = Array.from(tagSet);

  // Pull candidates that match at least one tag in expertise.
  const candidates = await User.find({
    "expertise.subject": { $in: tagList },
    ...(requesterId ? { _id: { $ne: requesterId } } : {}),
  }).select("name avatarUrl expertise availabilityStatus points badges");

  const scored = candidates
    .filter((c) => allowedByAvailabilityPreference(c.availabilityStatus, availabilityPreference))
    .map((c) => {
      const matchedAreas = c.expertise.filter((e) => tagSet.has(e.subject));
      const tagMatchCount = matchedAreas.length;
      const tagMatchRatio = tagList.length === 0 ? 0 : tagMatchCount / tagList.length;
      const avgProf =
        matchedAreas.length === 0
          ? 0
          : matchedAreas.reduce((sum, e) => sum + PROFICIENCY_WEIGHT[e.proficiency], 0) /
            matchedAreas.length;

      const tagScore = 50 * tagMatchRatio;
      const proficiencyScore = 25 * (avgProf / 4);
      const pointsScore = 15 * normalizePoints(c.points);
      const availScore = 10 * availabilityFactor(c.availabilityStatus);

      const score = tagScore + proficiencyScore + pointsScore + availScore;

      const reasons: string[] = [];
      if (tagMatchCount > 0) reasons.push(`Matches ${tagMatchCount} topic tag(s)`);
      if (avgProf > 0) reasons.push(`Expertise proficiency ~ ${avgProf.toFixed(1)}/4`);
      if (c.points > 0) reasons.push(`Reputation points: ${c.points}`);
      reasons.push(`Availability: ${c.availabilityStatus}`);

      return {
        expertId: c.id,
        score: Number(score.toFixed(2)),
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

