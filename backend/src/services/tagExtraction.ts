import { callLlm } from "./llm";

const MAX_TAGS = 8;
const MIN_GENERATED_TAGS = 3;

const KEYWORD_TAGS: Array<[RegExp, string]> = [
  [/\btypescript\b/i, "typescript"],
  [/\bjavascript\b/i, "javascript"],
  [/\bnode(?:\.js)?\b/i, "nodejs"],
  [/\breact\b/i, "react"],
  [/\bnext\.js\b|\bnextjs\b/i, "nextjs"],
  [/\btypescript\b|\bjavascript\b|\bnode(?:\.js)?\b|\breact\b|\bnext\.js\b|\bnextjs\b/i, "web-development"],
  [/\bexpress\b|\bapi\b|\brest\b|\bgraphql\b/i, "backend"],
  [/\bexpress\b/i, "express"],
  [/\bapi\b|\brest\b/i, "api-design"],
  [/\bgraphql\b/i, "graphql"],
  [/\bmongo(?:db)?\b|\bmongoose\b|\bpostgres(?:ql)?\b|\bsql\b|\bdatabase\b|\bindex(?:es|ing)?\b/i, "database"],
  [/\bmongo(?:db)?\b|\bmongoose\b/i, "mongodb"],
  [/\bpostgres(?:ql)?\b|\bsql\b/i, "sql"],
  [/\bindex(?:es|ing)?\b|\bquery plan\b/i, "database-indexing"],
  [/\bdocker\b|\bkubernetes\b|\bci\/?cd\b|\bdeploy(?:ment)?\b|\bdevops\b/i, "devops"],
  [/\bdocker\b/i, "docker"],
  [/\bkubernetes\b/i, "kubernetes"],
  [/\bci\/?cd\b|\bdeploy(?:ment)?\b/i, "deployment"],
  [/\bauth(?:entication|orization)?\b|\bjwt\b|\boauth\b|\bsecurity\b|\bcors\b|\bcaptcha\b/i, "security"],
  [/\bjwt\b/i, "jwt"],
  [/\boauth\b/i, "oauth"],
  [/\bcors\b/i, "cors"],
  [/\bcaptcha\b|\bhcaptcha\b|\brecaptcha\b/i, "captcha"],
  [/\bperformance\b|\blatency\b|\bthroughput\b|\bmemory\b|\boptimi[sz]e\b/i, "performance"],
  [/\btime complexity\b|\bbig[ -]?o\b/i, "time-complexity"],
  [/\bspace complexity\b/i, "space-complexity"],
  [/\bbug\b|\berror\b|\bexception\b|\btraceback\b|\bdebug(?:ging)?\b|\bnot working\b|\bbroken\b/i, "debugging"],
  [/\bembedding(?:s)?\b/i, "embeddings"],
  [/\brag\b|\bretrieval augmented generation\b|\bretrieval\b/i, "retrieval-augmented-generation"],
  [/\brerank(?:er|ing)?\b|\bcross[ -]?encoder\b/i, "reranking"],
  [/\bvector\b|\bsemantic search\b|\bhybrid search\b/i, "vector-search"],
  [/\bdsa\b|\balgorithm(?:s)?\b|\bdata structure(?:s)?\b|\bcomplexity\b/i, "dsa"],
  [/\balgorithm(?:s)?\b|\bdynamic programming\b|\bgraph(?:s)?\b|\btree(?:s)?\b/i, "algorithms"],
  [/\bdata structure(?:s)?\b|\bstack(?:s)?\b|\bqueue(?:s)?\b|\blinked list(?:s)?\b|\bheap(?:s)?\b/i, "data-structures"],
  [/\bdynamic programming\b|\bdp\b/i, "dynamic-programming"],
  [/\bgraph(?:s)?\b|\bbfs\b|\bdfs\b/i, "graph-algorithms"],
  [/\bcircuit\b|\belectrical\b|\belectronics\b|\bembedded\b/i, "electrical-engineering"],
  [/\bembedded\b|\bmicrocontroller\b|\barduino\b/i, "embedded-systems"],
  [/\bmechanical\b|\bthermodynamics\b|\bdynamics\b|\bbeam\b|\bcad\b/i, "mechanical-engineering"],
  [/\bcad\b|\bsolidworks\b|\bautocad\b/i, "cad"],
  [/\bagentic\b|\bai agent(?:s)?\b|\bllm agent(?:s)?\b|\btool call(?:ing)?\b/i, "agentic-ai"],
  [/\bllm\b|\blarge language model(?:s)?\b|\bgemini\b|\bopenai\b/i, "llm"],
  [/\bworkflow automation\b|\bai automation\b|\bautomation\b/i, "ai-automation"],
];

function normalizeTag(tag: string) {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function normalizeContentTags(tags: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tag of tags) {
    const clean = normalizeTag(tag);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      normalized.push(clean);
    }
  }
  return normalized.slice(0, MAX_TAGS);
}

function fallbackTags(text: string) {
  return normalizeContentTags(
    KEYWORD_TAGS.flatMap(([pattern, tag]) => (pattern.test(text) ? [tag] : []))
  );
}

function subjectTags(subject?: string) {
  if (!subject) return [];
  const normalized = normalizeTag(subject);
  const subjectText = subject.toLowerCase();
  const tags = [normalized];

  if (/\bdsa\b|data structures?|algorithms?/i.test(subjectText)) {
    tags.push("dsa", "algorithms", "data-structures");
  }
  if (/software|web|backend|frontend/i.test(subjectText)) {
    tags.push("software-engineering");
  }
  if (/ai|artificial intelligence|agent/i.test(subjectText)) {
    tags.push("artificial-intelligence");
  }

  return normalizeContentTags(tags);
}

function ensureMinimumTags(tags: string[], text: string, subject?: string) {
  const expanded = normalizeContentTags([
    ...tags,
    ...fallbackTags(text),
    ...subjectTags(subject),
  ]);

  if (expanded.length >= MIN_GENERATED_TAGS) return expanded;

  const generic = ["technical-question", "troubleshooting", "engineering"];
  return normalizeContentTags([...expanded, ...generic]).slice(0, Math.max(MIN_GENERATED_TAGS, expanded.length));
}

function parseTags(raw: string) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const jsonSource = jsonMatch?.[0] ?? raw;
  try {
    const parsed = JSON.parse(jsonSource) as { tags?: unknown };
    if (Array.isArray(parsed.tags)) {
      return normalizeContentTags(parsed.tags.filter((tag): tag is string => typeof tag === "string"));
    }
  } catch {
    // Fall through to simple parsing for non-JSON model output.
  }

  return normalizeContentTags(
    raw
      .split(/[\n,]/)
      .map((tag) => tag.replace(/^[-*\d.\s"'`:[\]{}]+/, ""))
      .filter((tag) => !/^here(?:\s+is|'s)?\b/i.test(tag))
  );
}

export async function generateContentTags(input: {
  title?: string;
  subject?: string;
  body: string;
  existingTags?: string[];
}) {
  const text = [
    input.subject ? `Subject: ${input.subject}` : "",
    input.title ? `Title: ${input.title}` : "",
    `Content: ${input.body}`,
  ]
    .filter(Boolean)
    .join("\n");
  const existingTags = normalizeContentTags(input.existingTags ?? []);

  try {
    const raw = await callLlm(
      [
        {
          role: "system",
          content:
            "You extract smart topic tags for an engineering collaboration platform. Return ONLY JSON like {\"tags\":[\"tag-one\",\"tag-two\",\"tag-three\"]}. Generate 3 to 6 specific lowercase hyphenated tags. Prefer concrete concepts, tools, domains, and problem types over generic tags. No explanations.",
        },
        {
          role: "user",
          content:
            `${text}\nExisting user tags: ${existingTags.join(", ") || "none"}\n` +
            "Generate tags even if the user provided no tags. Keep useful user tags, but add smarter inferred tags.",
        },
      ],
      { maxTokens: 260, jsonMode: true, thinkingBudget: 0 }
    );

    const llmTags = parseTags(raw);
    return ensureMinimumTags([...existingTags, ...llmTags], text, input.subject);
  } catch (err) {
    console.error("[tagExtraction] Gemini tag generation failed", err);
    return ensureMinimumTags(existingTags, text, input.subject);
  }
}
