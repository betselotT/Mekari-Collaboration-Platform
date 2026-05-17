import mongoose from "mongoose";
import { Thread, SimilarProblemData } from "../models/Thread";
import { Message } from "../models/Message";
import { callLlm, isLlmAvailable } from "./llm";

type Candidate = SimilarProblemData & {
  source: "knowledge" | "thread";
  body: string;
};

type Query = {
  threadId?: string;
  title: string;
  body?: string;
  subject: string;
  tags: string[];
  limit?: number;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
]);

function tokenize(text: string) {
  return text
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length > 1 && !STOP_WORDS.has(token)) ?? [];
}

function normalizeTag(tag: string) {
  return tag.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cosine(a: string, b: string) {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  if (!aTokens.length || !bTokens.length) return 0;

  const aCounts = new Map<string, number>();
  const bCounts = new Map<string, number>();
  for (const token of aTokens) aCounts.set(token, (aCounts.get(token) ?? 0) + 1);
  for (const token of bTokens) bCounts.set(token, (bCounts.get(token) ?? 0) + 1);

  const keys = new Set([...aCounts.keys(), ...bCounts.keys()]);
  let dot = 0;
  let aMag = 0;
  let bMag = 0;
  for (const key of keys) {
    const av = aCounts.get(key) ?? 0;
    const bv = bCounts.get(key) ?? 0;
    dot += av * bv;
    aMag += av * av;
    bMag += bv * bv;
  }

  if (!aMag || !bMag) return 0;
  return dot / (Math.sqrt(aMag) * Math.sqrt(bMag));
}

function jaccard(a: string[], b: string[]) {
  const aSet = new Set(a.map(normalizeTag).filter(Boolean));
  const bSet = new Set(b.map(normalizeTag).filter(Boolean));
  if (!aSet.size && !bSet.size) return 0;

  const intersection = [...aSet].filter((tag) => bSet.has(tag)).length;
  const union = new Set([...aSet, ...bSet]).size;
  return union ? intersection / union : 0;
}

function qualityScore(candidate: Pick<Candidate, "solution" | "threadSummary" | "tags">) {
  const hasSolution = candidate.solution.trim() ? 0.45 : 0;
  const hasSummary = candidate.threadSummary.trim() ? 0.2 : 0;
  const solutionLength = Math.min(0.25, candidate.solution.split(/\s+/).filter(Boolean).length / 280);
  const tagCoverage = Math.min(0.1, candidate.tags.length / 50);
  return hasSolution + hasSummary + solutionLength + tagCoverage;
}

function scoreCandidate(query: Query, candidate: Candidate) {
  const queryText = [query.title, query.subject, query.body, query.tags.join(" ")].filter(Boolean).join(" ");
  const candidateText = [
    candidate.title,
    candidate.body,
    candidate.threadSummary,
    candidate.solution,
    candidate.tags.join(" "),
  ].join(" ");
  const tagScore = jaccard([query.subject, ...query.tags], candidate.tags);
  const textScore = cosine(queryText, candidateText);
  const quality = qualityScore(candidate);
  const similarity = tagScore * 0.35 + textScore * 0.65;
  const combined = similarity * 0.9 + quality * 0.1;

  return {
    ...candidate,
    similarity: Number(similarity.toFixed(4)),
    qualityScore: Number(quality.toFixed(4)),
    combinedScore: Number(combined.toFixed(4)),
    reasons: [
      tagScore > 0 ? "Overlapping topic tags" : "Textually related problem",
      candidate.solution ? "Includes a captured solution" : "Solved thread context",
    ],
  };
}

function toSimilarProblem(candidate: Candidate): SimilarProblemData {
  return {
    docId: candidate.docId,
    threadId: candidate.threadId,
    title: candidate.title,
    tags: candidate.tags,
    solution: candidate.solution,
    threadSummary: candidate.threadSummary,
    similarity: candidate.similarity,
    qualityScore: candidate.qualityScore,
    combinedScore: candidate.combinedScore,
    reasons: candidate.reasons,
  };
}

async function loadKnowledgeCandidates(query: Query): Promise<Candidate[]> {
  const collection = mongoose.connection.collection("knowledgedocs");
  const tagTerms = [query.subject, ...query.tags].map(normalizeTag).filter(Boolean);
  const docs = await collection
    .find(tagTerms.length ? { tags: { $in: tagTerms } } : {})
    .sort({ createdAt: -1 })
    .limit(80)
    .toArray();

  return docs
    .filter((doc) => String(doc.questionId ?? doc._id) !== String(query.threadId ?? ""))
    .map((doc) => ({
      source: "knowledge" as const,
      docId: String(doc._id),
      threadId: String(doc.questionId ?? doc._id),
      title: String(doc.title ?? "Untitled"),
      tags: Array.isArray(doc.tags) ? doc.tags.map(String) : [],
      body: String(doc.body ?? ""),
      solution: String(doc.solution ?? ""),
      threadSummary: String(doc.threadSummary ?? ""),
      similarity: 0,
      qualityScore: 0,
      combinedScore: 0,
      reasons: [],
    }));
}

async function loadSolvedThreadCandidates(query: Query): Promise<Candidate[]> {
  const threads = await Thread.find({
    _id: { $ne: query.threadId },
    $or: [{ isSolved: true }, { status: "SOLVED" }],
  })
    .sort({ updatedAt: -1 })
    .limit(80)
    .select("title body subject tags solutionMsgId aiResponse updatedAt")
    .lean();

  const solutionIds = threads.map((thread) => thread.solutionMsgId).filter(Boolean);
  const solutionMessages = solutionIds.length
    ? await Message.find({ _id: { $in: solutionIds } }).select("body").lean()
    : [];
  const solutionMap = new Map(solutionMessages.map((message) => [String(message._id), message.body]));

  return threads.map((thread) => {
    const solution = thread.solutionMsgId ? solutionMap.get(String(thread.solutionMsgId)) ?? "" : "";
    const summary =
      thread.aiResponse?.explanation ||
      [thread.title, thread.body].filter(Boolean).join(" ").slice(0, 300);
    return {
      source: "thread" as const,
      docId: String(thread._id),
      threadId: String(thread._id),
      title: thread.title,
      tags: [...new Set([thread.subject, ...(thread.tags ?? [])].filter(Boolean))],
      body: thread.body ?? "",
      solution,
      threadSummary: summary,
      similarity: 0,
      qualityScore: 0,
      combinedScore: 0,
      reasons: [],
    };
  });
}

async function rerankSimilarWithLlm(query: Query, candidates: Candidate[], limit: number) {
  if (!isLlmAvailable() || candidates.length === 0) {
    return candidates.slice(0, limit).map(toSimilarProblem);
  }

  try {
    const raw = await callLlm(
      [
        {
          role: "system",
          content:
            'You are an AI retrieval ranker for a technical Q&A platform. Pick previously solved problems that would genuinely help answer the new learner question. Return only JSON. First character must be "{".',
        },
        {
          role: "user",
          content: JSON.stringify({
            question: {
              title: query.title,
              subject: query.subject,
              tags: query.tags,
              body: query.body ?? "",
            },
            candidates: candidates.slice(0, 18).map((candidate) => ({
              id: candidate.docId,
              threadId: candidate.threadId,
              title: candidate.title,
              tags: candidate.tags,
              summary: candidate.threadSummary.slice(0, 220),
              solution: candidate.solution.slice(0, 220),
              baselineScore: candidate.combinedScore,
            })),
            output:
              'Return {"matches":[{"docId":"candidate id","score":0-100,"reasons":["short reason","short reason"]}]} with at most the requested number of matches.',
            requestedMatches: limit,
          }),
        },
      ],
      { jsonMode: true, maxTokens: 1000, thinkingBudget: 0 }
    );
    const parsed = JSON.parse(raw) as {
      matches?: Array<{ docId?: string; id?: string; score?: number; reasons?: string[] }>;
    };
    const byId = new Map(candidates.map((candidate) => [candidate.docId, candidate]));
    const ranked: SimilarProblemData[] = [];
    const seen = new Set<string>();

    for (const match of parsed.matches ?? []) {
      const docId = match.docId ?? match.id;
      if (!docId || seen.has(docId)) continue;
      const candidate = byId.get(docId);
      if (!candidate) continue;
      seen.add(docId);
      ranked.push({
        ...toSimilarProblem(candidate),
        combinedScore: Math.max(0, Math.min(1, Number(match.score ?? candidate.combinedScore) / 100)),
        reasons: Array.isArray(match.reasons) && match.reasons.length ? match.reasons.slice(0, 3) : candidate.reasons,
      });
    }

    if (ranked.length > 0) return ranked.slice(0, limit);
  } catch (err) {
    console.error("[similarProblems] LLM rerank failed", err);
  }

  return candidates.slice(0, limit).map(toSimilarProblem);
}

export async function findSimilarProblems(query: Query): Promise<SimilarProblemData[]> {
  const limit = Math.max(1, Math.min(query.limit ?? 5, 10));
  const [knowledgeCandidates, solvedThreadCandidates] = await Promise.all([
    loadKnowledgeCandidates(query),
    loadSolvedThreadCandidates(query),
  ]);

  const byThread = new Map<string, Candidate>();
  for (const candidate of [...knowledgeCandidates, ...solvedThreadCandidates]) {
    const scored = scoreCandidate(query, candidate);
    if (scored.similarity < 0.12) continue;
    const existing = byThread.get(scored.threadId);
    if (!existing || scored.combinedScore > existing.combinedScore) {
      byThread.set(scored.threadId, scored);
    }
  }

  const ranked = [...byThread.values()].sort((a, b) => b.combinedScore - a.combinedScore);
  return rerankSimilarWithLlm(query, ranked, limit);
}
