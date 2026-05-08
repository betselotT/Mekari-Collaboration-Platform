"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { DashboardLayout } from "../../../../components/layout";
import { Button } from "../../../../components/ui/Button";
import { Avatar } from "../../../../components/ui/Avatar";
import { Badge } from "../../../../components/ui/Badge";
import { apiClient } from "../../../../lib/api";
import { useAuth } from "../../../../lib/useAuth";
import { ensureSocket } from "../../../../lib/useSocket";
import {
  Send,
  Bot,
  Users,
  CheckCircle,
  Video,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import type { Socket } from "socket.io-client";

interface Sender {
  _id: string;
  name: string;
  avatarUrl?: string;
}

interface ChatMessage {
  _id: string;
  thread: string;
  sender: Sender | string;
  body: string;
  type: string;
  isFromAi: boolean;
  createdAt: string;
  upvotes?: string[];
}

interface AIResponse {
  explanation: string;
  steps: string[];
  suggestedSolution: string;
  confidence: number;
  resolved: boolean;
}

interface Expert {
  _id?: string;
  expertId?: string;
  name?: string;
  score?: number;
  reasons?: string[];
}

interface Thread {
  _id: string;
  title: string;
  subject: string;
  body?: string;
  tags: string[];
  status: string;
  aiResponse?: AIResponse;
  matchedExperts: Expert[];
  googleMeetLink?: string;
  createdBy: Sender;
  isSolved: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  OPEN: "default",
  PENDING_EXPERT: "warning",
  AI_RESOLVED: "info",
  SOLVED: "success",
  CLOSED: "error",
};

function senderName(sender: Sender | string): string {
  if (typeof sender === "string") return "User";
  return sender.name || "User";
}

function senderInitials(sender: Sender | string): string {
  const name = senderName(sender);
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ThreadDetailPage() {
  const params = useParams<{ id: string }>();
  const threadId = params?.id ?? "";
  const { user, loading: authLoading } = useAuth();

  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [aiPanel, setAiPanel] = useState(true);
  const [expertPanel, setExpertPanel] = useState(true);
  const [solveError, setSolveError] = useState<string | null>(null);
  const [sessionStarting, setSessionStarting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // ── Load thread + messages ──────────────────────────────────────────────
  useEffect(() => {
    if (!threadId) return;

    Promise.all([
      apiClient.get<{ thread: Thread }>(`/api/threads/${threadId}`),
      apiClient.get<{ messages: ChatMessage[] }>(`/api/threads/${threadId}/messages`),
    ])
      .then(([threadRes, msgRes]) => {
        setThread(threadRes.data.thread);
        setMessages(msgRes.data.messages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [threadId]);

  // ── Socket setup ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!threadId) return;

    let mounted = true;

    ensureSocket().then((socket) => {
      if (!mounted) return;
      socketRef.current = socket;

      socket.emit("join_room", threadId);

      socket.on("new_message", (msg: ChatMessage) => {
        if (msg.thread !== threadId) return;
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      });

      socket.on(
        "ai_response_ready",
        (data: { threadId: string; aiResponse: AIResponse | null; status: string }) => {
          if (data.threadId !== threadId) return;
          setThread((prev) =>
            prev
              ? { ...prev, aiResponse: data.aiResponse ?? prev.aiResponse, status: data.status }
              : prev
          );
          if (data.aiResponse) setAiPanel(true);
        }
      );

      socket.on(
        "expert_matched",
        (data: { threadId: string; experts: Expert[] }) => {
          if (data.threadId !== threadId) return;
          setThread((prev) =>
            prev ? { ...prev, matchedExperts: data.experts, status: "PENDING_EXPERT" } : prev
          );
          setExpertPanel(true);
        }
      );

      socket.on("thread_solved", (data: { threadId: string }) => {
        if (data.threadId !== threadId) return;
        setThread((prev) => (prev ? { ...prev, status: "SOLVED", isSolved: true } : prev));
      });

      socket.on("user_typing", ({ userId }: { userId: string; threadId: string }) => {
        setTypingUsers((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
      });

      socket.on("user_stopped_typing", ({ userId }: { userId: string }) => {
        setTypingUsers((prev) => prev.filter((id) => id !== userId));
      });
    });

    return () => {
      mounted = false;
      const socket = socketRef.current;
      if (socket) {
        socket.emit("leave_room", threadId);
        socket.off("new_message");
        socket.off("ai_response_ready");
        socket.off("expert_matched");
        socket.off("thread_solved");
        socket.off("user_typing");
        socket.off("user_stopped_typing");
      }
    };
  }, [threadId]);

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Typing indicator ────────────────────────────────────────────────────
  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    const socket = socketRef.current;
    if (!socket) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("typing_start", threadId);
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit("typing_stop", threadId);
    }, 2000);
  }, [threadId]);

  // ── Send message ────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");

    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("typing_stop", threadId);
      isTypingRef.current = false;
      socket.emit("send_message", { threadId, body: text, type: "TEXT" });
      setSending(false);
    } else {
      try {
        await apiClient.post(`/api/threads/${threadId}/messages`, { body: text });
      } catch (err) {
        console.error(err);
      } finally {
        setSending(false);
      }
    }
  }

  // ── Mark solved ─────────────────────────────────────────────────────────
  async function markSolved(msgId: string) {
    setSolveError(null);
    try {
      const res = await apiClient.patch<{ thread: Thread }>(`/api/threads/${threadId}/solve`, {
        solutionMsgId: msgId,
      });
      setThread(res.data.thread);
    } catch (err: any) {
      setSolveError(err?.response?.data?.error?.message || "Failed to mark solved");
    }
  }

  // ── Start session ───────────────────────────────────────────────────────
  async function startSession() {
    setSessionStarting(true);
    try {
      const res = await apiClient.post<{ meetLink: string }>(`/api/threads/${threadId}/session`);
      setThread((prev) => (prev ? { ...prev, googleMeetLink: res.data.meetLink } : prev));
      window.open(res.data.meetLink, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
    } finally {
      setSessionStarting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout title="Loading..." searchPlaceholder="Search...">
        <div className="flex h-64 items-center justify-center text-neutral-500">Loading thread…</div>
      </DashboardLayout>
    );
  }

  if (!thread) {
    return (
      <DashboardLayout title="Thread not found" searchPlaceholder="Search...">
        <div className="flex h-64 items-center justify-center text-neutral-500">Thread not found.</div>
      </DashboardLayout>
    );
  }

  const isAuthor = user?._id === (thread.createdBy as any)?._id ||
                   user?._id === String(thread.createdBy);
  const statusVariant = (STATUS_COLOR[thread.status] || "default") as any;
  const hasAI = !!thread.aiResponse;
  const hasExperts = thread.matchedExperts && thread.matchedExperts.length > 0;

  return (
    <DashboardLayout title={thread.title} searchPlaceholder="Search threads...">
      {/* Thread header */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 flex-wrap">
          <Badge variant="info">{thread.subject.toUpperCase()}</Badge>
          <Badge variant={statusVariant}>{thread.status.replace("_", " ")}</Badge>
          {thread.tags.map((tag) => (
            <Badge key={tag} variant="default" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">{thread.title}</h1>
        {thread.body && (
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{thread.body}</p>
        )}

        {/* Actions row */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          {isAuthor && thread.status !== "SOLVED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={startSession}
              isLoading={sessionStarting}
            >
              <Video className="mr-1.5 h-4 w-4" />
              Start Session
            </Button>
          )}
          {thread.googleMeetLink && (
            <a
              href={thread.googleMeetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300"
            >
              <Video className="h-4 w-4 text-green-500" />
              Join Session
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Chat area (2/3) ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Messages */}
          <div className="flex flex-col gap-3 min-h-[400px] max-h-[60vh] overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
            {messages.map((msg) => {
              const isMe = user && (typeof msg.sender === "object"
                ? msg.sender._id === user._id
                : msg.sender === user._id);
              const isSys = msg.type === "SYSTEM_EVENT";
              const isAiMsg = msg.isFromAi;

              if (isSys) {
                return (
                  <div key={msg._id} className="flex justify-center">
                    <div className="flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                      <Video className="h-3.5 w-3.5" />
                      {msg.body}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg._id}
                  className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}
                >
                  {isAiMsg ? (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
                      <Bot className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                    </div>
                  ) : (
                    <Avatar
                      size="sm"
                      initials={senderInitials(msg.sender)}
                      src={typeof msg.sender === "object" ? msg.sender.avatarUrl : undefined}
                    />
                  )}
                  <div className={`flex max-w-[75%] flex-col gap-1 ${isMe ? "items-end" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        {isAiMsg ? "Mekari AI" : senderName(msg.sender)}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div
                      className={`rounded-xl px-4 py-2.5 text-sm ${
                        isMe
                          ? "bg-primary-600 text-white"
                          : isAiMsg
                          ? "border border-primary-200 bg-primary-50 text-neutral-900 dark:border-primary-800 dark:bg-primary-950/30 dark:text-neutral-100"
                          : "border border-neutral-200 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                    </div>
                    {/* Mark as solution button — only thread author, only non-AI, only unsolved */}
                    {isAuthor && !msg.isFromAi && thread.status !== "SOLVED" && !isMe && (
                      <button
                        onClick={() => markSolved(msg._id)}
                        className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Mark as solution
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <div className="flex gap-0.5">
                  <span className="animate-bounce">•</span>
                  <span className="animate-bounce [animation-delay:0.1s]">•</span>
                  <span className="animate-bounce [animation-delay:0.2s]">•</span>
                </div>
                {typingUsers.length === 1 ? "Someone is typing…" : `${typingUsers.length} people are typing…`}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {solveError && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
              {solveError}
            </p>
          )}

          {/* Input bar */}
          {thread.status !== "SOLVED" && thread.status !== "CLOSED" && (
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500"
                placeholder="Type your message…"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={sending}
              />
              <Button
                variant="primary"
                size="md"
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                isLoading={sending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}

          {thread.status === "SOLVED" && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
              <CheckCircle className="h-4 w-4" />
              This thread has been solved.
            </div>
          )}
        </div>

        {/* ── Side panels (1/3) ───────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* AI Response panel */}
          {hasAI && (
            <div className="rounded-xl border border-primary-200 bg-primary-50/50 dark:border-primary-800/50 dark:bg-primary-950/20">
              <button
                className="flex w-full items-center justify-between px-4 py-3"
                onClick={() => setAiPanel((v) => !v)}
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  <span className="text-sm font-semibold text-primary-800 dark:text-primary-200">
                    AI Analysis
                  </span>
                  <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900 dark:text-primary-300">
                    {Math.round((thread.aiResponse!.confidence || 0) * 100)}% confident
                  </span>
                </div>
                {aiPanel ? (
                  <ChevronUp className="h-4 w-4 text-primary-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-primary-500" />
                )}
              </button>

              {aiPanel && (
                <div className="border-t border-primary-200/50 px-4 pb-4 pt-3 dark:border-primary-800/30">
                  <p className="mb-3 text-sm text-neutral-700 dark:text-neutral-300">
                    {thread.aiResponse!.explanation}
                  </p>

                  {thread.aiResponse!.steps.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Steps
                      </p>
                      <ol className="list-decimal list-inside space-y-1">
                        {thread.aiResponse!.steps.map((step, i) => (
                          <li key={i} className="text-sm text-neutral-700 dark:text-neutral-300">
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {thread.aiResponse!.suggestedSolution && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Suggested Solution
                      </p>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                        {thread.aiResponse!.suggestedSolution}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Matched Experts panel */}
          {hasExperts && (
            <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
              <button
                className="flex w-full items-center justify-between px-4 py-3"
                onClick={() => setExpertPanel((v) => !v)}
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    Matched Experts
                  </span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    {thread.matchedExperts.length}
                  </span>
                </div>
                {expertPanel ? (
                  <ChevronUp className="h-4 w-4 text-neutral-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-neutral-400" />
                )}
              </button>

              {expertPanel && (
                <div className="border-t border-neutral-200 dark:border-neutral-700">
                  {thread.matchedExperts.map((expert, i) => {
                    const id = (expert as any)._id || expert.expertId || String(i);
                    const name = (expert as any).name || "Expert";
                    const score = expert.score;
                    const reasons = expert.reasons || [];

                    return (
                      <div
                        key={id}
                        className="flex items-start gap-3 border-b border-neutral-100 px-4 py-3 last:border-0 dark:border-neutral-700/50"
                      >
                        <Avatar size="sm" initials={name.slice(0, 2).toUpperCase()} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-neutral-900 dark:text-white">
                            {name}
                          </p>
                          {score !== undefined && (
                            <p className="text-xs text-neutral-500">
                              Match score: {score.toFixed(0)}
                            </p>
                          )}
                          {reasons.slice(0, 2).map((r, ri) => (
                            <p key={ri} className="mt-0.5 text-xs text-neutral-400">
                              • {r}
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* AI loading indicator — when status is OPEN and no AI response yet */}
          {!hasAI && thread.status === "OPEN" && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-center dark:border-neutral-700 dark:bg-neutral-800">
              <Zap className="mx-auto mb-2 h-5 w-5 animate-pulse text-primary-500" />
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                AI is analyzing your question…
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Results will appear here automatically.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
