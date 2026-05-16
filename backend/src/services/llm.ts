0
export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?: {
    message?: string;
  };
}

export function isLlmAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function callLlm(
  messages: LlmMessage[],
  options: { maxTokens?: number; jsonMode?: boolean } = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const systemParts = messages
    .filter((message) => message.role === "system" && message.content)
    .map((message) => ({ text: message.content }));
  const contents = messages
    .filter((message) => message.role !== "system" && message.content)
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

  const generationConfig: Record<string, string | number> = {
    maxOutputTokens: options.maxTokens ?? 1000,
  };
  if (options.jsonMode) {
    generationConfig.responseMimeType = "application/json";
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig,
  };
  if (systemParts.length > 0) {
    body.systemInstruction = { parts: systemParts };
  }

  const baseUrl =
    process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta";
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const url = new URL(`${baseUrl}/models/${model}:generateContent`);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as GeminiResponse;

  if (!response.ok) {
    throw new Error(
      `Gemini API error ${response.status}: ${data.error?.message ?? response.statusText}`
    );
  }

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part) => part.text ?? "").join("").trim();
  if (!text) {
    throw new Error("Gemini API response did not contain text output");
  }
  return text;
}
