import { callLlm } from "./llm";

const MAX_TAGS = 8;

const KEYWORD_TAGS: Array<[RegExp, string]> = [
  [/\btypescript\b|\bjavascript\b|\bnode(?:\.js)?\b|\breact\b|\bnext(?:\.js)?\b/i, "web-development"],
  [/\bexpress\b|\bapi\b|\brest\b|\bgraphql\b/i, "backend"],
  [/\bmongo(?:db)?\b|\bmongoose\b|\bpostgres(?:ql)?\b|\bsql\b|\bdatabase\b|\bindex(?:es|ing)?\b/i, "database"],
  [/\bdocker\b|\bkubernetes\b|\bci\/?cd\b|\bdeploy(?:ment)?\b|\bdevops\b/i, "devops"],
  [/\bauth(?:entication|orization)?\b|\bjwt\b|\boauth\b|\bsecurity\b|\bcors\b|\bcaptcha\b/i, "security"],
  [/\bperformance\b|\blatency\b|\bthroughput\b|\bmemory\b|\boptimi[sz]e\b/i, "performance"],
  [/\bbug\b|\berror\b|\bexception\b|\btraceback\b|\bdebug(?:ging)?\b|\bfail(?:ed|ure)?\b/i, "debugging"],
  [/\bembedding(?:s)?\b/i, "embeddings"],
  [/\brag\b|\bretrieval augmented generation\b|\bretrieval\b/i, "retrieval-augmented-generation"],
  [/\brerank(?:er|ing)?\b|\bcross[ -]?encoder\b/i, "reranking"],
  [/\bvector\b|\bsemantic search\b|\bhybrid search\b/i, "vector-search"],
  [/\bdsa\b|\balgorithm(?:s)?\b|\bdata structure(?:s)?\b|\bcomplexity\b/i, "algorithms"],
  [/\bcircuit\b|\belectrical\b|\belectronics\b|\bembedded\b/i, "electrical-engineering"],
  [/\bmechanical\b|\bthermodynamics\b|\bdynamics\b|\bbeam\b|\bcad\b/i, "mechanical-engineering"],
];

function normalizeTag(tag: string) {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function uniqueTags(tags: string[]) {
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
  return uniqueTags(
    KEYWORD_TAGS.flatMap(([pattern, tag]) => (pattern.test(text) ? [tag] : []))
  );
}

function parseTags(raw: string) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const jsonSource = jsonMatch?.[0] ?? raw;
  try {
    const parsed = JSON.parse(jsonSource) as { tags?: unknown };
    if (Array.isArray(parsed.tags)) {
      return uniqueTags(parsed.tags.filter((tag): tag is string => typeof tag === "string"));
    }
  } catch {
    // Fall through to simple parsing for non-JSON model output.
  }

  return uniqueTags(
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
  const existingTags = uniqueTags(input.existingTags ?? []);

  try {
    const raw = await callLlm(
      [
        {
          role: "system",
          content:
            "You extract topic tags for an engineering collaboration platform. Return ONLY JSON like {\"tags\":[\"tag-one\",\"tag-two\"]}. Use lowercase hyphenated tags, max 6, no explanations.",
        },
        { role: "user", content: `${text}\nExisting tags: ${existingTags.join(", ")}` },
      ],
      { maxTokens: 180, jsonMode: true }
    );

    const llmTags = parseTags(raw);
    return uniqueTags([...existingTags, ...llmTags, ...fallbackTags(text)]);
  } catch (err) {
    console.error("[tagExtraction] Gemini tag generation failed", err);
    return uniqueTags([...existingTags, ...fallbackTags(text)]);
  }
}
