import { User, ExpertiseArea, IUser } from "../models/User";
import { generateContentTags } from "./tagExtraction";
import { recommendExperts } from "./matching";
import { GeminiChatMessage } from "./gemini";

export type AiEscalationExpert = {
  _id: string;
  name: string;
  avatarUrl?: string;
  expertise: ExpertiseArea[];
  skillTags: string[];
  availabilityStatus: IUser["availabilityStatus"];
  points: number;
  score: number;
  reasons: string[];
};

export type AiEscalationDecision = {
  shouldEscalate: boolean;
  reason: string;
  urgency: "immediate" | "soon";
  subject: string;
  tags: string[];
  experts: AiEscalationExpert[];
};

type EscalationSignal = {
  reason: string;
  urgency: AiEscalationDecision["urgency"];
  subject?: string;
  tags?: string[];
};

const HIGH_STAKES_PATTERNS: Array<[RegExp, string, string[]]> = [
  [/\b(security breach|hacked|vulnerability|exploit|xss|sql injection|csrf|data leak|credential|password dump)\b/i, "Security issue needs human review", ["security"]],
  [/\b(production down|outage|data loss|corrupt(?:ed|ion)|incident|rollback|hotfix)\b/i, "Production or data-loss risk needs an expert", ["incident-response", "production"]],
  [/\b(load-bearing|structural|high voltage|mains voltage|medical|legal|financial advice)\b/i, "High-impact advice should be reviewed by a qualified human", ["high-stakes"]],
];

const COMPLEXITY_PATTERNS: Array<[RegExp, string, string[]]> = [
  [/\b(system design|architecture|scalability|distributed system|microservice|migration strategy)\b/i, "Architecture tradeoffs benefit from expert matching", ["architecture", "system-design"]],
  [/\b(code review|review my code|audit|is this safe|threat model)\b/i, "Review requests need human judgment", ["review"]],
  [/\b(requirements are unclear|not enough context|confidential|private repo|can't share code)\b/i, "The assistant lacks enough private context to answer reliably", ["needs-context"]],
];

const UNCERTAINTY_PATTERNS = [
  /\bi (?:can'?t|cannot|do not|don't) (?:answer|determine|verify|access)\b/i,
  /\bi (?:need|would need) (?:more|additional) (?:context|information|details)\b/i,
  /\bnot enough (?:context|information|details)\b/i,
  /\bconsult (?:a|an) (?:human|expert|professional|qualified)\b/i,
  /\bbeyond my (?:ability|scope|capabilities)\b/i,
];

function inferSubject(text: string) {
  if (/\b(circuit|electrical|electronics|embedded|microcontroller|arduino|voltage|current)\b/i.test(text)) {
    return "Electrical Engineering";
  }
  if (/\b(mechanical|thermodynamics|fluid|beam|cad|solidworks|autocad)\b/i.test(text)) {
    return "Mechanical Engineering";
  }
  if (/\b(civil|structural|concrete|load-bearing|foundation)\b/i.test(text)) {
    return "Civil Engineering";
  }
  if (/\b(algorithm|data structure|dsa|dynamic programming|graph|tree|complexity)\b/i.test(text)) {
    return "Data Structures & Algorithms";
  }
  if (/\b(ai|llm|machine learning|rag|embedding|agentic|gemini|openai)\b/i.test(text)) {
    return "Artificial Intelligence";
  }
  return "Software Engineering";
}

function findSignal(prompt: string, responseText?: string): EscalationSignal | null {
  const text = `${prompt}\n${responseText || ""}`;

  for (const [pattern, reason, tags] of HIGH_STAKES_PATTERNS) {
    if (pattern.test(text)) {
      return { reason, urgency: "immediate", subject: inferSubject(text), tags };
    }
  }

  for (const [pattern, reason, tags] of COMPLEXITY_PATTERNS) {
    if (pattern.test(text)) {
      return { reason, urgency: "soon", subject: inferSubject(text), tags };
    }
  }

  if (responseText && UNCERTAINTY_PATTERNS.some((pattern) => pattern.test(responseText))) {
    return {
      reason: "The assistant was uncertain or could not answer completely",
      urgency: "soon",
      subject: inferSubject(text),
      tags: ["expert-help"],
    };
  }

  return null;
}

function historyText(messages: GeminiChatMessage[]) {
  return messages
    .slice(-6)
    .map((message) => `${message.role}: ${message.text}`)
    .join("\n");
}

export async function decideAiEscalation(params: {
  requesterId?: string;
  prompt: string;
  responseText?: string;
  messages?: GeminiChatMessage[];
}): Promise<AiEscalationDecision> {
  const contextText = [historyText(params.messages || []), params.prompt, params.responseText || ""]
    .filter(Boolean)
    .join("\n");
  const signal = findSignal(params.prompt, params.responseText);
  const subject = signal?.subject || inferSubject(contextText);

  if (!signal) {
    return {
      shouldEscalate: false,
      reason: "AI answer appears within assistant scope",
      urgency: "soon",
      subject,
      tags: [],
      experts: [],
    };
  }

  const tags = await generateContentTags({
    title: params.prompt.slice(0, 120),
    subject,
    body: contextText,
    existingTags: signal.tags || [],
  });

  const recommendations = await recommendExperts({
    requesterId: params.requesterId,
    subject,
    tags,
    title: params.prompt.slice(0, 120),
    body: contextText,
    availabilityPreference: signal.urgency === "immediate" ? "online_or_busy" : "any",
    limit: 3,
  });

  const experts = await User.find({ _id: { $in: recommendations.map((rec) => rec.expertId) } })
    .select("name avatarUrl expertise skillTags availabilityStatus points")
    .lean();
  const expertById = new Map(experts.map((expert) => [String(expert._id), expert]));

  const matchedExperts: AiEscalationExpert[] = [];
  for (const rec of recommendations) {
    const expert = expertById.get(rec.expertId);
    if (!expert) continue;
    matchedExperts.push({
      _id: String(expert._id),
      name: expert.name,
      avatarUrl: expert.avatarUrl,
      expertise: expert.expertise || [],
      skillTags: expert.skillTags || [],
      availabilityStatus: expert.availabilityStatus,
      points: expert.points || 0,
      score: rec.score,
      reasons: rec.reasons,
    });
  }

  return {
    shouldEscalate: true,
    reason: signal.reason,
    urgency: signal.urgency,
    subject,
    tags,
    experts: matchedExperts,
  };
}
