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
  if (status === "in_session") return 0.3;
  return 0;
}

function allowedByAvailabilityPreference(
  status: IUser["availabilityStatus"],
  pref: MatchAvailabilityPreference
) {
  if (pref === "any") return true;
  if (pref === "online_or_busy")
    return status === "online" || status === "busy" || status === "in_session";
  return status === "online";
}

function normalizePoints(points: number) {
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
  const rawTerms = [subject, ...tags].map((t) => t.trim()).filter(Boolean);
  const tagSet = new Set(rawTerms.map((t) => t.toLowerCase()));
  // Case-insensitive regex for each term
  const tagRegexes = rawTerms.map((t) => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"));

  const baseFilter = {
    ...(requesterId ? { _id: { $ne: requesterId } } : {}),
    role: { $in: ["expert", "admin"] },
    $or: [
      { "expertVerification.status": "approved" },
      { expertVerification: { $exists: false } },
    ],
  };

  // Try tag-matched experts first
  let candidates = await User.find({
    $and: [
      baseFilter,
      {
        $or: [
      { "expertise.subject": { $in: tagRegexes } },
      { skillTags: { $in: tagRegexes } },
        ],
      },
    ],
  }).select("name avatarUrl expertise skillTags availabilityStatus points badges");

  // Fallback: if no tag match, return approved mentors with expertise or skill tags.
  if (candidates.length === 0) {
    candidates = (await User.find({
      $and: [
        baseFilter,
        {
          $or: [
            { "expertise.0": { $exists: true } },
            { skillTags: { $exists: true, $ne: [] } },
          ],
        },
      ],
    }).select("name avatarUrl expertise skillTags availabilityStatus points badges")) as typeof candidates;
  }

  const scored = candidates
    .filter((c) => allowedByAvailabilityPreference(c.availabilityStatus, availabilityPreference))
    .map((c) => {
      // Check expertise match case-insensitively
      const matchedAreas = c.expertise.filter((e) =>
        tagSet.has(e.subject.toLowerCase())
      );
      // Also check skillTags
      const matchedTags = c.skillTags.filter((s) => tagSet.has(s.toLowerCase()));
      const tagMatchCount = matchedAreas.length + matchedTags.length;
      const tagMatchRatio =
        rawTerms.length === 0 ? 0 : Math.min(1, tagMatchCount / rawTerms.length);

      const avgProf =
        matchedAreas.length === 0
          ? 1
          : matchedAreas.reduce(
              (sum, e) => sum + PROFICIENCY_WEIGHT[e.proficiency],
              0
            ) / matchedAreas.length;

      const tagScore = 50 * tagMatchRatio;
      const proficiencyScore = 25 * (avgProf / 4);
      const pointsScore = 15 * normalizePoints(c.points);
      const availScore = 10 * availabilityFactor(c.availabilityStatus);

      const score = tagScore + proficiencyScore + pointsScore + availScore;

      const reasons: string[] = [];
      if (tagMatchCount > 0)
        reasons.push(`Matches ${tagMatchCount} topic tag(s)`);
      else
        reasons.push(`General expert available`);
      if (avgProf > 1) reasons.push(`Expertise level ~ ${avgProf.toFixed(1)}/4`);
      if (c.points > 0) reasons.push(`${c.points} reputation points`);
      reasons.push(`Status: ${c.availabilityStatus}`);

      return {
        expertId: c.id,
        score: Number(score.toFixed(2)),
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Second fallback: if preference filtered everything out, try with "any"
  if (scored.length === 0 && availabilityPreference !== "any") {
    return recommendExperts({ ...params, availabilityPreference: "any" });
  }

  return scored;
}
