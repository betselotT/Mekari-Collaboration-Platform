/**
 * Thin HTTP client for the Python intelligence microservice.
 * All intelligence computation is delegated to the FastAPI service on port 5000.
 */

const BASE_URL = process.env.INTELLIGENCE_SERVICE_URL ?? "http://localhost:5000";

export interface QuestionContext {
  intent: string;
  domain: string;
  complexity: string;
  entities: string[];
  detected_tags: string[];
  language_detected: string | null;
  has_code: boolean;
  has_error: boolean;
  urgency: string;
}

export interface AIResponse {
  explanation: string;
  steps: string[];
  suggested_solution: string;
  confidence: number;
  resolved: boolean;
}

export interface RankedAIResponse extends AIResponse {
  quality_score: number;
  adjusted_confidence: number;
  quality_factors: Record<string, number>;
}

export interface SimilarProblem {
  doc_id: string;
  thread_id: string;
  title: string;
  tags: string[];
  solution: string;
  thread_summary: string;
  similarity: number;
  quality_score: number;
  combined_score: number;
}

export interface ExpertMatch {
  expert_id: string;
  name: string;
  avatar_url: string | null;
  score: number;
  availability: string;
  specialization: number;
  past_accuracy: number;
  response_speed: number;
  tag_overlap: number;
  reasons: string[];
}

export interface EscalationDecision {
  should_escalate: boolean;
  mode: string;
  reason: string;
  urgency: string;
  decision_confidence: number;
}

export interface AnalyzeResponse {
  context: QuestionContext;
  ai_response: AIResponse;
  ranked_ai_response: RankedAIResponse;
  similar_problems: SimilarProblem[];
  escalation: EscalationDecision;
  suggested_tags: string[];
  new_status: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Intelligence service error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function analyze(params: {
  thread_id: string;
  title: string;
  body: string;
  subject: string;
  tags: string[];
}): Promise<AnalyzeResponse> {
  return post<AnalyzeResponse>("/analyze", params);
}

export async function suggestTags(params: {
  title: string;
  body: string;
  subject: string;
  existing_tags: string[];
}): Promise<string[]> {
  const res = await post<{ tags: string[] }>("/tags", params);
  return res.tags;
}

export async function findSimilar(params: {
  title: string;
  body?: string;
  tags: string[];
  subject: string;
  limit?: number;
}): Promise<SimilarProblem[]> {
  const res = await post<{ problems: SimilarProblem[] }>("/similar", params);
  return res.problems;
}

export async function matchExperts(params: {
  subject: string;
  tags: string[];
  requester_id?: string;
  availability_preference?: string;
  limit?: number;
}): Promise<ExpertMatch[]> {
  const res = await post<{ experts: ExpertMatch[] }>("/experts", params);
  return res.experts;
}

export async function recordFeedback(params: {
  type: string;
  thread_id?: string;
  user_id?: string;
  target_id?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await post("/feedback", params);
}

export async function captureKnowledge(params: {
  thread_id: string;
  title: string;
  body: string;
  subject: string;
  tags: string[];
  solution: string;
  ai_response_dict?: Record<string, unknown>;
}): Promise<{ captured: boolean; doc_id?: string }> {
  return post("/capture", {
    ...params,
    ai_response_dict: params.ai_response_dict ?? {},
  });
}

export async function isAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
