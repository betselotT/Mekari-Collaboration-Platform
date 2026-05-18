import { User, ExpertiseArea, IUser } from "../models/User";
import { MatchAvailabilityPreference } from "../models/MatchRequest";
import { callLlm, isLlmAvailable } from "./llm";

const PROFICIENCY_WEIGHT: Record<ExpertiseArea["proficiency"], number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

const MAX_LLM_CANDIDATES = 24;

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

function normalizeTerm(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bai\b/g, " artificial intelligence ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function termVariants(value: string) {
  const normalized = normalizeTerm(value);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const variants = new Set<string>([normalized, ...tokens]);

  if (tokens.includes("artificial") && tokens.includes("intelligence")) variants.add("ai");
  if (tokens.includes("agentic")) {
    variants.add("agentic ai");
    variants.add("agentic artificial intelligence");
  }
  if (tokens.includes("automation") && (tokens.includes("ai") || tokens.includes("artificial"))) {
    variants.add("ai automation");
    variants.add("artificial intelligence automation");
  }
  if (tokens.includes("machine") && tokens.includes("learning")) variants.add("ml");
  if (
    tokens.includes("dsa") ||
    (tokens.includes("data") && tokens.includes("structures") && tokens.includes("algorithms"))
  ) {
    variants.add("dsa");
    variants.add("data structures");
    variants.add("algorithms");
    variants.add("algorithm");
    variants.add("data structures algorithms");
    variants.add("data structures and algorithms");
  }
  if (tokens.includes("dynamic") && tokens.includes("programming")) variants.add("dp");

  return variants;
}

function buildTermSet(values: string[]) {
  const terms = new Set<string>();
  for (const value of values) {
    for (const variant of termVariants(value)) {
      if (variant) terms.add(variant);
    }
  }
  return terms;
}

function extractContentSignals(text: string) {
  const signals: string[] = [];
  const patterns: Array<[RegExp, string]> = [
    [/\bagentic\b/i, "agentic ai"],
    [/\bai automation\b|\bautomation\b/i, "ai automation"],
    [/\bllm\b|\blarge language model/i, "llm"],
    [/\bagent(s)?\b/i, "llm agents"],
    [/\btool call(s|ing)?\b|\bfunction call(s|ing)?\b/i, "tool calling"],
    [/\bworkflow(s)?\b|\borchestrat(e|ion)\b/i, "workflow automation"],
    [/\brag\b|\bretrieval augmented generation\b/i, "retrieval-augmented-generation"],
    [/\bembedding(s)?\b/i, "embeddings"],
    [/\bvector search\b|\bsemantic search\b/i, "vector-search"],
    [/\bcomputer vision\b|\bimage processing\b/i, "computer-vision"],
    [/\bdata science\b|\bmachine learning\b|\bml\b/i, "machine-learning"],
    [/\bdsa\b|\bdata structures?\b|\balgorithms?\b|\btime complexity\b|\bspace complexity\b/i, "data structures and algorithms"],
    [/\bdynamic programming\b|\bdp\b/i, "dynamic programming"],
    [/\bgraph(s)?\b|\bgraph traversal\b|\bbfs\b|\bdfs\b/i, "graph algorithms"],
    [/\bbinary tree\b|\btree traversal\b|\blinked list\b|\bstack\b|\bqueue\b|\bheap\b/i, "data structures"],
  ];

  for (const [pattern, signal] of patterns) {
    if (pattern.test(text)) signals.push(signal);
  }
  return signals;
}

function overlapScore(queryTerms: Set<string>, expertTerms: Set<string>) {
  if (queryTerms.size === 0 || expertTerms.size === 0) return 0;

  let exact = 0;
  let partial = 0;
  for (const query of queryTerms) {
    if (expertTerms.has(query)) {
      exact += 1;
      continue;
    }

    const queryTokens = query.split(/\s+/).filter(Boolean);
    if (
      queryTokens.length > 1 &&
      queryTokens.some((token) => expertTerms.has(token))
    ) {
      partial += 0.35;
    }
  }

  return Math.min(1, (exact + partial) / Math.max(1, queryTerms.size));
}

export type ExpertRecommendation = {
  expertId: string;
  score: number;
  reasons: string[];
};

type InternalRecommendation = ExpertRecommendation & {
  profile: {
    expertId: string;
    name: string;
    expertise: ExpertiseArea[];
    skillTags: string[];
    primaryTechnicalField?: string;
    bio?: string;
    availabilityStatus: IUser["availabilityStatus"];
    points: number;
  };
};

type LlmMatchResponse = {
  matches?: Array<{
    expertId?: string;
    score?: number;
    reasons?: string[];
  }>;
  rankings?: Array<{
    expertId?: string;
    score?: number;
    reasons?: string[];
  }>;
};

type LlmMatch = {
  expertId?: string;
  id?: string;
  score?: number;
  reasons?: string[];
};

function stripProfile(recommendation: InternalRecommendation): ExpertRecommendation {
  return {
    expertId: recommendation.expertId,
    score: recommendation.score,
    reasons: recommendation.reasons,
  };
}

function parseLlmJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("LLM response was not JSON");
    return JSON.parse(match[0]);
  }
}

function clampScore(score: unknown, fallback: number) {
  if (typeof score !== "number" || Number.isNaN(score)) return fallback;
  return Math.max(0, Math.min(100, score));
}

function shouldRetryCompactPrompt(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return !/429|quota|rate limit/i.test(message);
}

function compactCandidate(candidate: InternalRecommendation) {
  return {
    id: candidate.expertId,
    name: candidate.profile.name,
    expertise: candidate.profile.expertise.map((area) => ({
      subject: area.subject,
      level: area.proficiency,
    })),
    skills: candidate.profile.skillTags,
    field: candidate.profile.primaryTechnicalField ?? "",
    bio: candidate.profile.bio?.slice(0, 220) ?? "",
    status: candidate.profile.availabilityStatus,
    reputation: candidate.profile.points,
    baseline: {
      score: candidate.score,
      reasons: candidate.reasons,
    },
  };
}

function normalizeLlmMatches(parsed: unknown): LlmMatch[] {
  if (Array.isArray(parsed)) return parsed as LlmMatch[];

  const response = parsed as LlmMatchResponse;
  if (Array.isArray(response.matches)) return response.matches;
  if (Array.isArray(response.rankings)) return response.rankings;
  return [];
}

async function requestLlmMatches(
  params: {
    subject: string;
    tags: string[];
    title?: string;
    body?: string;
  },
  candidateSlate: InternalRecommendation[],
  limit: number,
  compact = false
) {
  const raw = await callLlm(
    [
      {
        role: "system",
        content:
          'You are the primary AI expert-matching engine for a technical learning platform. Read the learner problem and mentor profiles semantically. Rank mentors by problem-fit first. Specific domain expertise beats broad software expertise and availability. Return only a JSON object. The first character must be "{". No markdown. No prose.',
      },
      {
        role: "user",
        content: JSON.stringify({
          task:
            "Choose the best mentors for the learner. Infer synonyms and related domains yourself. DSA means Data Structures & Algorithms. Agentic AI relates to LLM agents, tool use, workflow automation, and AI automation.",
          requestedMatches: limit,
          learnerProblem: {
            subject: params.subject,
            tags: params.tags,
            title: params.title ?? "",
            body: compact ? (params.body ?? "").slice(0, 500) : params.body ?? "",
          },
          mentors: candidateSlate.map((candidate) => {
            const base = compactCandidate(candidate);
            if (!compact) return base;
            return {
              id: base.id,
              expertise: base.expertise,
              skills: base.skills,
              field: base.field,
              status: base.status,
              baseline: base.baseline.score,
            };
          }),
          output:
            'Return exactly this JSON shape: {"matches":[{"expertId":"mentor id from mentors[].id","score":0-100,"reasons":["topic fit <=8 words","profile fit <=8 words"]}]}. Keep every reason under 8 words.',
        }),
      },
    ],
    { jsonMode: true, maxTokens: compact ? 900 : 1400, thinkingBudget: 0 }
  );
  try {
    return normalizeLlmMatches(parseLlmJson(raw));
  } catch (err) {
    throw err;
  }
}

async function rankWithLlm(
  params: {
    subject: string;
    tags: string[];
    title?: string;
    body?: string;
  },
  candidates: InternalRecommendation[],
  limit: number
): Promise<ExpertRecommendation[]> {
  if (!isLlmAvailable() || candidates.length === 0) {
    return candidates.slice(0, limit).map(stripProfile);
  }

  const candidateSlate = candidates.slice(0, MAX_LLM_CANDIDATES);

  try {
    let llmMatches: LlmMatch[] = [];
    try {
      llmMatches = await requestLlmMatches(params, candidateSlate, limit);
    } catch (err) {
      if (!shouldRetryCompactPrompt(err)) throw err;
      console.warn("[matching] Primary LLM match response was invalid; retrying compact prompt", err);
      llmMatches = await requestLlmMatches(params, candidateSlate.slice(0, 12), limit, true);
    }
    if (llmMatches.length === 0) {
      llmMatches = await requestLlmMatches(params, candidateSlate.slice(0, 12), limit, true);
    }
    const byId = new Map(candidateSlate.map((candidate) => [candidate.expertId, candidate]));
    const used = new Set<string>();
    const ranked: ExpertRecommendation[] = [];

    for (const ranking of llmMatches) {
      const expertId = ranking.expertId ?? ranking.id;
      if (!expertId || used.has(expertId)) continue;
      const candidate = byId.get(expertId);
      if (!candidate) continue;
      used.add(expertId);
      ranked.push({
        expertId: candidate.expertId,
        score: Number(clampScore(ranking.score, candidate.score).toFixed(2)),
        reasons:
          Array.isArray(ranking.reasons) && ranking.reasons.length > 0
            ? ranking.reasons.slice(0, 3)
            : candidate.reasons,
      });
    }

    if (ranked.length > 0) {
      return ranked.slice(0, limit);
    }

    return candidateSlate.slice(0, limit).map(stripProfile);
  } catch (err) {
    console.error("[matching] LLM expert matching failed", err);
    return candidates.slice(0, limit).map(stripProfile);
  }
}

export async function recommendExperts(params: {
  requesterId?: string;
  subject: string;
  tags: string[];
  title?: string;
  body?: string;
  availabilityPreference: MatchAvailabilityPreference;
  limit?: number;
}): Promise<ExpertRecommendation[]> {
  const { requesterId, subject, tags, title = "", body = "", availabilityPreference, limit = 5 } = params;
  const contentSignals: string[] = [];
  const combinedText = `${subject} ${title} ${body} ${tags.join(" ")}`.toLowerCase();
  if (/\bdsa\b|data structures?|algorithms?|dynamic programming|graphs?|trees?|stacks?|queues?/i.test(combinedText)) {
    contentSignals.push("DSA", "Data Structures & Algorithms", "algorithms", "data structures");
  }
  if (/agentic|llm|ai automation|tool call|workflow automation/i.test(combinedText)) {
    contentSignals.push("Agentic AI Engineer", "agentic ai", "llm agents", "ai automation");
  }
  const rawTerms = [
    subject,
    title,
    ...tags,
    ...contentSignals,
    ...extractContentSignals(combinedText),
  ]
    .map((t) => t.trim())
    .filter(Boolean);
  const queryTerms = buildTermSet(rawTerms);

  const baseFilter = {
    ...(requesterId ? { _id: { $ne: requesterId } } : {}),
    role: { $in: ["expert", "admin"] },
  };

  const candidates = await User.find({
    $and: [
      baseFilter,
      {
        $or: [
          { "expertise.0": { $exists: true } },
          { skillTags: { $exists: true, $ne: [] } },
        ],
      },
    ],
  }).select("name avatarUrl expertise skillTags availabilityStatus points badges primaryTechnicalField bio");

  const scored = candidates
    .filter((c) => allowedByAvailabilityPreference(c.availabilityStatus, availabilityPreference))
    .map((c) => {
      const expertise = c.expertise || [];
      const skillTags = c.skillTags || [];
      const expertTerms = buildTermSet([
        ...expertise.map((e) => e.subject),
        ...skillTags,
        c.primaryTechnicalField || "",
        c.bio || "",
      ]);
      const tagMatchRatio = overlapScore(queryTerms, expertTerms);
      const matchedAreas = expertise.filter((e) => {
        const areaTerms = termVariants(e.subject);
        return [...areaTerms].some((term) => queryTerms.has(term));
      });
      const matchedTags = skillTags.filter((tag) => {
        const tagTerms = termVariants(tag);
        return [...tagTerms].some((term) => queryTerms.has(term));
      });
      const tagMatchCount = matchedAreas.length + matchedTags.length;

      const avgProf =
        matchedAreas.length === 0
          ? 1
          : matchedAreas.reduce(
              (sum, e) => sum + PROFICIENCY_WEIGHT[e.proficiency],
              0
            ) / matchedAreas.length;

      const exactSubjectMatch = matchedAreas.length > 0 || matchedTags.length > 0;
      const tagScore = 70 * tagMatchRatio;
      const exactMatchBonus = exactSubjectMatch ? 15 : 0;
      const proficiencyScore = 18 * (avgProf / 4);
      const pointsScore = 4 * normalizePoints(c.points);
      const availScore = 3 * availabilityFactor(c.availabilityStatus);

      const score = tagScore + exactMatchBonus + proficiencyScore + pointsScore + availScore;

      const reasons: string[] = [];
      if (tagMatchCount > 0) reasons.push(`Matches ${tagMatchCount} profile topic(s)`);
      else if (tagMatchRatio > 0) reasons.push("Related expertise by content similarity");
      else reasons.push("General mentor available");
      if (avgProf > 1) reasons.push(`Expertise level ~ ${avgProf.toFixed(1)}/4`);
      if (c.points > 0) reasons.push(`${c.points} reputation points`);
      reasons.push(`Status: ${c.availabilityStatus}`);

      return {
        expertId: c.id,
        score: Number(score.toFixed(2)),
        reasons,
        profile: {
          expertId: c.id,
          name: c.name,
          expertise,
          skillTags,
          primaryTechnicalField: c.primaryTechnicalField,
          bio: c.bio,
          availabilityStatus: c.availabilityStatus,
          points: c.points,
        },
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_LLM_CANDIDATES);

  const generalFallback = candidates
    .filter((c) => allowedByAvailabilityPreference(c.availabilityStatus, availabilityPreference))
    .map((c) => {
      const expertise = c.expertise || [];
      const bestProf = expertise.reduce(
        (best, area) => Math.max(best, PROFICIENCY_WEIGHT[area.proficiency]),
        1
      );
      const score =
        20 * (bestProf / 4) +
        15 * normalizePoints(c.points) +
        10 * availabilityFactor(c.availabilityStatus);

      return {
        expertId: c.id,
        score: Number(score.toFixed(2)),
        reasons: [
          "Available mentor with relevant engineering profile",
          `Status: ${c.availabilityStatus}`,
          ...(c.points > 0 ? [`${c.points} reputation points`] : []),
        ],
        profile: {
          expertId: c.id,
          name: c.name,
          expertise,
          skillTags: c.skillTags || [],
          primaryTechnicalField: c.primaryTechnicalField,
          bio: c.bio,
          availabilityStatus: c.availabilityStatus,
          points: c.points,
        },
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_LLM_CANDIDATES);

  // Second fallback: if preference filtered everything out, try with "any"
  if (scored.length === 0 && availabilityPreference !== "any") {
    return recommendExperts({ ...params, availabilityPreference: "any" });
  }

  const mergedCandidates = [...scored];
  const seen = new Set(mergedCandidates.map((candidate) => candidate.expertId));
  for (const fallback of generalFallback) {
    if (!seen.has(fallback.expertId)) mergedCandidates.push(fallback);
  }

  return rankWithLlm(params, mergedCandidates, limit);
}
