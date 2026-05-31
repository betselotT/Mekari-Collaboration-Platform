"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AxiosError } from "axios";
import { AlertCircle, CheckCircle, Cpu, DraftingCompass, MessageSquare, Plus, Send, UserRoundCheck, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../components/layout";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { apiClient } from "../../../lib/api";
import { useLanguage } from "../../../lib/i18n";

type ChatMessage = {
  role: "user" | "model";
  text: string;
  timestamp: string;
  escalation?: AiEscalation;
};

type AiChatResponse = {
  message: {
    body: string;
    createdAt: string;
    isFromAi: boolean;
  };
  model?: string;
  escalation?: AiEscalation;
};

type EscalationExpert = {
  _id: string;
  name: string;
  avatarUrl?: string;
  expertise: Array<{ subject: string; proficiency: string }>;
  skillTags: string[];
  availabilityStatus: "online" | "busy" | "offline" | "in_session";
  points: number;
  score: number;
  reasons: string[];
};

type AiEscalation = {
  shouldEscalate: boolean;
  reason: string;
  urgency: "immediate" | "soon";
  subject: string;
  tags: string[];
  experts: EscalationExpert[];
};

const starterMessage: ChatMessage = {
  role: "model",
  text:
    "Hi, I am Mekari AI. Ask me about engineering concepts, architecture tradeoffs, debugging, formulas, circuits, algorithms, mechanics, or design decisions. I will keep the answer practical and explain the reasoning.",
  timestamp: "Just now",
};

const CHAT_STORAGE_KEY = "mekari_ai_chat_history";

const quickPrompts = [
  {
    icon: Cpu,
    title: "Explain an algorithm",
    prompt: "Explain Dijkstra's algorithm with a small engineering-style example.",
  },
  {
    icon: DraftingCompass,
    title: "Compare designs",
    prompt: "Compare monolithic and microservice architectures for a student collaboration platform.",
  },
  {
    icon: CheckCircle,
    title: "Debug a concept",
    prompt: "Why does a race condition happen in concurrent systems, and how can engineers prevent it?",
  },
  {
    icon: AlertCircle,
    title: "Review assumptions",
    prompt: "What assumptions should I check before sizing a database schema for chat messages?",
  },
];

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isSavedChat(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.every(
      (message) =>
        message &&
        typeof message === "object" &&
        ((message as ChatMessage).role === "user" || (message as ChatMessage).role === "model") &&
        typeof (message as ChatMessage).text === "string" &&
        typeof (message as ChatMessage).timestamp === "string",
    )
  );
}

function expertTitle(expert: EscalationExpert) {
  const top = expert.expertise[0];
  if (!top) return "Verified expert";
  const level = top.proficiency === "expert" ? "Expert" : top.proficiency;
  return `${level} in ${top.subject}`;
}

function statusLabel(status: EscalationExpert["availabilityStatus"]) {
  if (status === "online") return "Online";
  if (status === "busy" || status === "in_session") return "Busy";
  return "Offline";
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${match.index}-bold`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <code
          key={`${match.index}-code`}
          className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[0.85em] text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderMessageText(text: string) {
  const blocks = text.split(/```/);

  return blocks.map((block, blockIndex) => {
    if (blockIndex % 2 === 1) {
      const lines = block.replace(/^\w+\n/, "").trim();
      return (
        <pre
          key={`code-${blockIndex}`}
          className="my-3 overflow-x-auto rounded-lg bg-neutral-950 p-3 text-xs leading-5 text-neutral-100"
        >
          <code>{lines}</code>
        </pre>
      );
    }

    return block
      .split("\n")
      .map((line, lineIndex) => {
        const trimmed = line.trim();
        const bullet = trimmed.match(/^[-*]\s+(.+)/);
        const numbered = trimmed.match(/^\d+\.\s+(.+)/);
        const heading = trimmed.match(/^(#{1,3})\s+(.+)/);
        const key = `line-${blockIndex}-${lineIndex}`;

        if (!trimmed) {
          return <div key={key} className="h-2" />;
        }

        if (heading) {
          return (
            <p key={key} className="mt-3 text-sm font-semibold first:mt-0">
              {renderInlineMarkdown(heading[2])}
            </p>
          );
        }

        if (bullet || numbered) {
          return (
            <p key={key} className="pl-4 text-sm leading-6">
              <span className="mr-2">{bullet ? "-" : `${trimmed.split(".")[0]}.`}</span>
              {renderInlineMarkdown((bullet || numbered)?.[1] || trimmed)}
            </p>
          );
        }

        return (
          <p key={key} className="text-sm leading-6">
            {renderInlineMarkdown(line)}
          </p>
        );
      });
  });
}

export default function AIAssistantPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const localizedStarterMessage = useMemo<ChatMessage>(
    () => ({ ...starterMessage, text: t(starterMessage.text), timestamp: t("Just now") }),
    [t],
  );
  const [messages, setMessages] = useState<ChatMessage[]>([localizedStarterMessage]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedSavedChat, setHasLoadedSavedChat] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const apiHistory = useMemo(
    () =>
      messages
        .slice(1)
        .map((message) => ({ role: message.role, text: message.text })),
    [messages],
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as unknown;
        if (isSavedChat(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } finally {
      setHasLoadedSavedChat(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedSavedChat) return;
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [hasLoadedSavedChat, messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isSending]);

  async function sendMessage(promptOverride?: string) {
    const prompt = (promptOverride ?? input).trim();
    if (!prompt || isSending) return;

    const userMessage: ChatMessage = {
      role: "user",
      text: prompt,
      timestamp: formatTime(),
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError(null);
    setIsSending(true);

    try {
      const res = await apiClient.post<AiChatResponse>("/api/ai/chat", {
        prompt,
        messages: apiHistory,
      });

      setMessages((current) => [
        ...current,
        {
          role: "model",
          text: res.data.message.body,
          timestamp: formatTime(new Date(res.data.message.createdAt)),
          escalation: res.data.escalation,
        },
      ]);
    } catch (err) {
      const axiosError = err as AxiosError<{ error?: { message?: string } }>;
      const message =
        axiosError.response?.data?.error?.message ||
        t("Mekari AI could not respond right now. Check the backend Gemini API key and try again.");
      setError(message);
      setMessages((current) => current.filter((message) => message !== userMessage));
      setInput(prompt);
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  function startNewChat() {
    setMessages([localizedStarterMessage]);
    setInput("");
    setError(null);
    window.localStorage.removeItem(CHAT_STORAGE_KEY);
  }

  async function contactExpert(expert: EscalationExpert) {
    if (expert.availabilityStatus !== "online") {
      router.push(`/dashboard/profile/${expert._id}`);
      return;
    }

    try {
      const res = await apiClient.post<{ conversation: { _id: string } }>(
        "/api/dms/conversations",
        { expertId: expert._id },
      );
      router.push(`/dashboard/messages?conversation=${res.data.conversation._id}`);
    } catch (err) {
      const axiosError = err as AxiosError<{ error?: { message?: string } }>;
      setError(axiosError.response?.data?.error?.message || "Failed to start direct message.");
    }
  }

  return (
    <DashboardLayout title={t("Mekari AI")} searchPlaceholder={t("Search engineering topics...")}>
      <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-5xl flex-col">
        <div className="mb-6 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <span>MEKARI</span>
          <span>/</span>
          <span>AI ASSISTANT</span>
        </div>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white sm:text-3xl">
              {t("Engineering concept assistant")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
              {t("Get focused help with engineering theory, implementation decisions, calculations, debugging, architecture, and technical tradeoffs.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={startNewChat} disabled={isSending}>
              <Plus className="mr-2 h-4 w-4" />
              {t("Start new chat")}
            </Button>
            {/* <div className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              <Zap className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              Gemini powered
            </div> */}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="flex min-h-[520px] min-w-0 flex-col rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900">
            <div ref={scrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3 sm:p-5">
              {messages.map((message, index) => (
                <div
                  key={`${message.timestamp}-${index}`}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-lg px-3 py-3 sm:max-w-[78%] sm:px-4 ${
                      message.role === "user"
                        ? "bg-primary-600 text-white"
                        : "border border-neutral-200 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    }`}
                  >
                    <div className="space-y-1">{renderMessageText(message.text)}</div>
                    {message.role === "model" && message.escalation?.shouldEscalate && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-neutral-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-neutral-100">
                        <div className="flex items-start gap-2">
                          <UserRoundCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                              {t("Escalation recommended")}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-200">
                              {message.escalation.reason}
                            </p>
                          </div>
                        </div>
                        {message.escalation.experts.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {message.escalation.experts.map((expert) => (
                              <div
                                key={expert._id}
                                className="rounded-lg border border-amber-200/70 bg-white p-2 dark:border-amber-900/60 dark:bg-neutral-900"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                                      {expert.name}
                                    </p>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                      {expertTitle(expert)} · {statusLabel(expert.availabilityStatus)}
                                    </p>
                                    <p className="mt-1 line-clamp-2 text-xs text-neutral-600 dark:text-neutral-300">
                                      {expert.reasons.slice(0, 2).join(" · ")}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => void contactExpert(expert)}
                                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-primary-600 px-2.5 text-xs font-semibold text-white hover:bg-primary-700"
                                  >
                                    <MessageSquare className="mr-1 h-3.5 w-3.5" />
                                    {expert.availabilityStatus === "online" ? "DM" : t("View")}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <p
                      className={`mt-2 text-xs ${
                        message.role === "user"
                          ? "text-primary-100"
                          : "text-neutral-500 dark:text-neutral-400"
                      }`}
                    >
                      {message.timestamp}
                    </p>
                  </div>
                </div>
              ))}

              {isSending && (
                <div className="flex justify-start">
                  <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                    {t("Thinking through the engineering context...")}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="mx-5 mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                {error}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="flex gap-2 border-t border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800 sm:p-4"
            >
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={t("Ask an engineering question...")}
                className="input m-0 min-w-0 flex-1 border-0 p-0"
                disabled={isSending}
              />
              <Button type="submit" variant="primary" size="sm" isLoading={isSending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </section>

          <aside className="space-y-4 lg:max-h-[calc(100dvh-13rem)] lg:overflow-y-auto">
            <h3 className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
              {t("Quick prompts")}
            </h3>
            {quickPrompts.map((suggestion) => {
              const Icon = suggestion.icon;
              return (
                <Card
                  key={suggestion.title}
                  hoverable
                  className="cursor-pointer p-4"
                  onClick={() => void sendMessage(suggestion.prompt)}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary-100 p-2 dark:bg-primary-900">
                      <Icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
                        {t(suggestion.title)}
                      </h4>
                      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                        {suggestion.prompt}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
