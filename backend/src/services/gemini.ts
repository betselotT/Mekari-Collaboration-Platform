export type GeminiChatMessage = {
  role: "user" | "model";
  text: string;
};

export type GeminiChatResult = {
  text: string;
  model: string;
};

type GeminiCandidate = {
  content?: {
    parts?: Array<{ text?: string }>;
  };
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
  error?: {
    message?: string;
  };
};

const DEFAULT_MODEL = "gemini-2.5-flash";

const engineeringSystemInstruction = `
You are Mekari AI, an engineering concepts assistant inside a collaboration platform.
Focus on software engineering, computer systems, electrical/electronics, mechanical, civil,
and general engineering problem solving. Explain concepts clearly, give practical steps,
use formulas or code snippets when useful, and ask for missing constraints before making
strong assumptions. Keep answers concise but complete. If a question needs private
project context, current production access, high-stakes professional review, or expertise
beyond what you can reliably provide, say that clearly and recommend escalation to a
qualified human expert. If the question is outside engineering, briefly steer the user
back to engineering support.
`;

function normalizeHistory(messages: GeminiChatMessage[], prompt: string) {
  const cleaned = messages
    .map((message) => ({
      role: message.role,
      text: message.text.trim(),
    }))
    .filter((message) => message.text.length > 0)
    .slice(-12);

  cleaned.push({ role: "user" as const, text: prompt.trim() });

  return cleaned.map((message) => ({
    role: message.role,
    parts: [{ text: message.text }],
  }));
}

export async function askGemini(
  prompt: string,
  messages: GeminiChatMessage[] = [],
): Promise<GeminiChatResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error("GEMINI_API_KEY is not configured");
    (error as Error & { status?: number }).status = 503;
    throw error;
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: engineeringSystemInstruction.trim() }],
        },
        contents: normalizeHistory(messages, prompt),
        generationConfig: {
          temperature: 0.45,
          topP: 0.9,
          maxOutputTokens: 900,
        },
      }),
    });
  } catch {
    const error = new Error(
      "Could not reach the Gemini API. Check the backend internet connection, firewall, and GEMINI_API_KEY."
    );
    (error as Error & { status?: number }).status = 503;
    throw error;
  }

  const data = (await response.json().catch(() => ({}))) as GeminiResponse;

  if (!response.ok) {
    const error = new Error(data.error?.message || "Gemini request failed");
    (error as Error & { status?: number }).status =
      response.status === 400 || response.status === 401 || response.status === 403
        ? 502
        : response.status;
    throw error;
  }

  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("\n")
      .trim() || "";

  if (!text) {
    const error = new Error("Gemini returned an empty response");
    (error as Error & { status?: number }).status = 502;
    throw error;
  }

  return { text, model };
}
