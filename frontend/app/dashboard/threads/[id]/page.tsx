"use client";

import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  CheckCheck,
  Video,
  ChevronDown,
  ChevronUp,
  Zap,
  Trash2,
  Reply,
  ArrowUp,
  X,
  BookOpen,
  Code2,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Smile,
  MessageSquare,
  } from "lucide-react";
import type { Socket } from "socket.io-client";

interface Sender {
  _id: string;
  name: string;
  avatarUrl?: string;
}

interface ChatMessage {
  id?: string;
  _id: string;
  thread: string;
  sender: Sender | string;
  body: string;
  type: string;
  attachmentUrl?: string;
  isFromAi: boolean;
  createdAt: string;
  upvotes?: string[];
  parentMessageId?: string;
  readBy?: Array<{
    user: string | Sender;
    readAt: string;
  }>;
}

type ComposerMode = "TEXT" | "CODE";

type AttachmentDraft = {
  type: "IMAGE" | "FILE";
  name: string;
  dataUrl: string;
};

const emojiOptions = ["👍", "🙏", "🎉", "💡", "✅", "🔥", "👀", "🚀"];

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

interface SimilarProblem {
  docId: string;
  threadId: string;
  title: string;
  tags: string[];
  solution: string;
  threadSummary: string;
  similarity: number;
  qualityScore: number;
  combinedScore: number;
  reasons: string[];
}

interface Thread {
  _id: string;
  title: string;
  subject: string;
  body?: string;
  tags: string[];
  status: string;
  googleMeetLink?: string;
  aiResponse?: AIResponse;
  similarProblems?: SimilarProblem[];
  matchedExperts: Expert[];
  createdBy: Sender;
  isSolved: boolean;
  solutionMsgId?: string;
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

function getMessageId(message: ChatMessage): string {
  return message._id || message.id || "";
}

function attachmentLabel(message: ChatMessage) {
  return message.body || (message.type === "IMAGE" ? "Shared image" : "Attached file");
}

function readReceiptUserId(receipt: NonNullable<ChatMessage["readBy"]>[number]) {
  return typeof receipt.user === "string" ? receipt.user : receipt.user?._id;
}

function senderId(sender: Sender | string) {
  return typeof sender === "string" ? sender : sender._id;
}

function messageReadByUser(message: ChatMessage, userId?: string) {
  if (!userId) return false;
  return (message.readBy || []).some((receipt) => readReceiptUserId(receipt) === userId);
}

function renderHighlightedCode(code: string) {
  const tokens = code.split(/(\b(?:async|await|break|catch|const|continue|else|export|for|from|function|if|import|let|return|throw|try|type|while)\b|\/\/.*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b\d+(?:\.\d+)?\b)/g);

  return tokens.map((token, index) => {
    let className = "text-neutral-100";
    if (/^(async|await|break|catch|const|continue|else|export|for|from|function|if|import|let|return|throw|try|type|while)$/.test(token)) {
      className = "text-sky-300";
    } else if (/^\/\//.test(token)) {
      className = "text-neutral-500";
    } else if (/^["'`]/.test(token)) {
      className = "text-emerald-300";
    } else if (/^\d/.test(token)) {
      className = "text-amber-300";
    }

    return (
      <span key={`${token}-${index}`} className={className}>
        {token}
      </span>
    );
  });
}

function MessageContent({ message }: { message: ChatMessage }) {
  if (message.type === "CODE") {
    return (
      <div className="max-w-full overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950 text-left">
        <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            Code snippet
          </span>
          <Code2 className="h-3.5 w-3.5 text-neutral-500" />
        </div>
        <pre className="max-h-80 max-w-full overflow-x-auto overflow-y-auto overscroll-contain p-3 text-xs leading-5">
          <code className="block min-w-0 whitespace-pre">{renderHighlightedCode(message.body)}</code>
        </pre>
      </div>
    );
  }

  if (message.type === "IMAGE" && message.attachmentUrl) {
    return (
      <figure className="space-y-2">
        <a href={message.attachmentUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={message.attachmentUrl}
            alt={attachmentLabel(message)}
            className="max-h-72 max-w-full rounded-lg border border-black/10 object-contain dark:border-white/10"
          />
        </a>
        <figcaption className="text-xs opacity-80">{attachmentLabel(message)}</figcaption>
      </figure>
    );
  }

  if (message.type === "FILE" && message.attachmentUrl) {
    return (
      <a
        href={message.attachmentUrl}
        download={attachmentLabel(message)}
        className="flex items-center gap-3 rounded-lg border border-current/15 bg-white/10 px-3 py-2 text-left hover:bg-white/15"
      >
        <FileText className="h-5 w-5 shrink-0" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{attachmentLabel(message)}</span>
          <span className="block text-xs opacity-70">Open or download attachment</span>
        </span>
      </a>
    );
  }

  return <p className="whitespace-pre-wrap break-words">{message.body}</p>;
}

export default function ThreadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const threadId = params?.id ?? "";
  const { user, loading: authLoading } = useAuth();

  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [composerMode, setComposerMode] = useState<ComposerMode>("TEXT");
  const [attachment, setAttachment] = useState<AttachmentDraft | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; name: string }>>([]);
  const [aiPanel, setAiPanel] = useState(true);
  const [expertPanel, setExpertPanel] = useState(true);
  const [similarPanel, setSimilarPanel] = useState(true);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarError, setSimilarError] = useState<string | null>(null);
  const [solveError, setSolveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [upvotingMessageId, setUpvotingMessageId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const [savingTags, setSavingTags] = useState(false);
  const [dmLoadingId, setDmLoadingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const readRequestKeyRef = useRef("");

  // ── Load thread + messages ──────────────────────────────────────────────
  useEffect(() => {
    if (!threadId) return;

    let mounted = true;

    async function loadThreadDetail() {
      setLoading(true);
      setLoadError(null);

      try {
        const threadRes = await apiClient.get<{ thread: Thread }>(`/api/threads/${threadId}`);
        if (!mounted) return;

        const loadedThread = threadRes.data.thread;
        setThread(loadedThread);

        try {
          const msgRes = await apiClient.get<{ messages: ChatMessage[] }>(
            `/api/threads/${threadId}/messages`
          );
          if (mounted) setMessages(msgRes.data.messages || []);
        } catch (messageErr: any) {
          if (mounted) {
            setMessages([]);
            setLoadError(
              messageErr?.response?.data?.error?.message ||
                "Thread loaded, but messages could not be loaded."
            );
          }
        }

        if (!loadedThread.similarProblems?.length) loadSimilarProblems();
      } catch (err: any) {
        if (!mounted) return;
        setThread(null);
        setMessages([]);
        const status = err?.response?.status;
        setLoadError(
          status === 404
            ? "Thread not found."
            : err?.response?.data?.error?.message || "Failed to load this thread."
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadThreadDetail();

    return () => {
      mounted = false;
    };
  }, [threadId]);

  async function loadSimilarProblems() {
    if (!threadId || similarLoading) return;
    setSimilarLoading(true);
    setSimilarError(null);
    try {
      const res = await apiClient.get<{ problems: SimilarProblem[] }>(
        `/api/threads/${threadId}/similar`
      );
      setThread((prev) => (prev ? { ...prev, similarProblems: res.data.problems } : prev));
      setSimilarPanel(true);
    } catch (err: any) {
      setSimilarError(err?.response?.data?.error?.message || "Failed to find similar problems");
    } finally {
      setSimilarLoading(false);
    }
  }

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

      socket.on(
        "similar_problems_ready",
        (data: { threadId: string; similarProblems: SimilarProblem[] }) => {
          if (data.threadId !== threadId) return;
          setThread((prev) =>
            prev ? { ...prev, similarProblems: data.similarProblems } : prev
          );
          setSimilarPanel(true);
        }
      );

      socket.on("thread_solved", (data: { threadId: string }) => {
        if (data.threadId !== threadId) return;
        setThread((prev) => (prev ? { ...prev, status: "SOLVED", isSolved: true } : prev));
      });

      socket.on("thread_tags_updated", (data: { threadId: string; tags: string[] }) => {
        if (data.threadId !== threadId) return;
        setThread((prev) => (prev ? { ...prev, tags: data.tags } : prev));
      });

      socket.on("message_deleted", (data: { threadId: string; messageId: string }) => {
        if (data.threadId !== threadId) return;
        setMessages((prev) => prev.filter((msg) => getMessageId(msg) !== data.messageId));
      });

      socket.on(
        "message_upvoted",
        (data: { threadId: string; messageId: string; upvotes: string[] }) => {
          if (data.threadId !== threadId) return;
          setMessages((prev) =>
            prev.map((msg) =>
              getMessageId(msg) === data.messageId ? { ...msg, upvotes: data.upvotes } : msg
            )
          );
        }
      );

      socket.on(
        "thread_messages_read",
        (data: { threadId: string; userId: string; messageIds: string[]; readAt: string }) => {
          if (data.threadId !== threadId) return;
          const readMessageIds = new Set(data.messageIds);
          setMessages((prev) =>
            prev.map((msg) => {
              const id = getMessageId(msg);
              if (!readMessageIds.has(id) || messageReadByUser(msg, data.userId)) return msg;
              return {
                ...msg,
                readBy: [...(msg.readBy || []), { user: data.userId, readAt: data.readAt }],
              };
            })
          );
        }
      );

      socket.on("user_typing", ({ userId, userName }: { userId: string; userName?: string; threadId: string }) => {
        if (userId === user?._id) return;
        setTypingUsers((prev) =>
          prev.some((item) => item.userId === userId)
            ? prev.map((item) =>
                item.userId === userId ? { ...item, name: userName || item.name } : item
              )
            : [...prev, { userId, name: userName || "Someone" }]
        );
      });

      socket.on("user_stopped_typing", ({ userId }: { userId: string }) => {
        setTypingUsers((prev) => prev.filter((item) => item.userId !== userId));
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
        socket.off("similar_problems_ready");
        socket.off("thread_solved");
        socket.off("thread_tags_updated");
        socket.off("message_deleted");
        socket.off("message_upvoted");
        socket.off("thread_messages_read");
        socket.off("user_typing");
        socket.off("user_stopped_typing");
      }
    };
  }, [threadId, user?._id]);

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Typing indicator ────────────────────────────────────────────────────
  const latestOwnReadMessageId = useMemo(() => {
    if (!user?._id) return "";

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const msg = messages[index];
      if (msg.type === "SYSTEM_EVENT" || msg.isFromAi || senderId(msg.sender) !== user._id) {
        continue;
      }

      const hasAnotherReader = (msg.readBy || []).some(
        (receipt) => readReceiptUserId(receipt) !== user._id
      );
      if (hasAnotherReader) return getMessageId(msg);
    }

    return "";
  }, [messages, user?._id]);

  useEffect(() => {
    if (!threadId || !user?._id) return;

    const unreadIncomingIds = messages
      .filter(
        (msg) =>
          msg.type !== "SYSTEM_EVENT" &&
          senderId(msg.sender) !== user._id &&
          !messageReadByUser(msg, user._id)
      )
      .map(getMessageId)
      .filter(Boolean);

    if (unreadIncomingIds.length === 0) return;

    const requestKey = `${threadId}:${unreadIncomingIds.join(",")}`;
    if (readRequestKeyRef.current === requestKey) return;
    readRequestKeyRef.current = requestKey;

    apiClient
      .post(`/api/threads/${threadId}/read`)
      .catch(() => {
        const socket = socketRef.current;
        if (socket?.connected) socket.emit("thread_mark_read", threadId);
      });
  }, [messages, threadId, user?._id]);

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
  function addEmoji(emoji: string) {
    handleInputChange(`${input}${emoji}`);
    setShowEmojiPicker(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function resetAttachment() {
    setAttachment(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>, kind: "IMAGE" | "FILE") {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxSize = 4 * 1024 * 1024;
    if (file.size > maxSize) {
      setActionError("Attachments must be 4MB or smaller.");
      event.target.value = "";
      return;
    }

    if (kind === "IMAGE" && !file.type.startsWith("image/")) {
      setActionError("Choose an image file for image messages.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        type: kind,
        name: file.name,
        dataUrl: String(reader.result),
      });
      setComposerMode("TEXT");
      setActionError(null);
      if (!input.trim()) handleInputChange(file.name);
    };
    reader.onerror = () => setActionError("Could not read the selected attachment.");
    reader.readAsDataURL(file);
  }

  async function sendMessage() {
    const text = input.trim();
    if ((!text && !attachment) || sending) return;

    setSending(true);
    setInput("");
    const parentMessageId = replyTo ? getMessageId(replyTo) : undefined;
    const messageType = attachment?.type || composerMode;
    const messageBody = text || attachment?.name || "Attachment";
    const attachmentUrl = attachment?.dataUrl;
    setReplyTo(null);
    setShowEmojiPicker(false);
    resetAttachment();

    const socket = socketRef.current;
    if (socket?.connected && !attachmentUrl) {
      socket.emit("typing_stop", threadId);
      isTypingRef.current = false;
      socket.emit("send_message", { threadId, body: messageBody, type: messageType, parentMessageId });
      setSending(false);
    } else {
      try {
        await apiClient.post(`/api/threads/${threadId}/messages`, {
          body: messageBody,
          type: messageType,
          attachmentUrl,
          parentMessageId,
        });
      } catch (err) {
        console.error(err);
        setActionError("Failed to send message.");
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

  function startTagEdit() {
    setTagDraft(thread?.tags.join(", ") || "");
    setTagError(null);
    setIsEditingTags(true);
  }

  async function saveTags() {
    if (!thread || savingTags) return;
    setSavingTags(true);
    setTagError(null);
    try {
      const tags = tagDraft
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const res = await apiClient.patch<{ thread: Thread }>(`/api/threads/${threadId}/tags`, {
        tags,
      });
      setThread(res.data.thread);
      setIsEditingTags(false);
    } catch (err: any) {
      setTagError(err?.response?.data?.error?.message || "Failed to update tags");
    } finally {
      setSavingTags(false);
    }
  }

  const getParentMessage = (parentId?: string) => {
  if (!parentId) return null;
  return messages.find((m) => getMessageId(m) === parentId);
  };

  function startReply(message: ChatMessage) {
    setReplyTo(message);
    setActionError(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function upvoteMessage(msgId: string) {
    if (!msgId || upvotingMessageId) return;

    setActionError(null);
    setUpvotingMessageId(msgId);
    try {
      const res = await apiClient.post<{ message: ChatMessage; upvoted: boolean }>(
        `/api/threads/${threadId}/messages/${msgId}/upvote`
      );
      setMessages((prev) =>
        prev.map((msg) => (getMessageId(msg) === msgId ? { ...msg, ...res.data.message } : msg))
      );
    } catch (err: any) {
      setActionError(err?.response?.data?.error?.message || "Failed to update upvote");
    } finally {
      setUpvotingMessageId(null);
    }
  }

  async function confirmDeleteMessage() {
    const msgId = deleteTarget ? getMessageId(deleteTarget) : "";
    if (!msgId || deletingMessageId) return;

    setDeleteError(null);
    setDeletingMessageId(msgId);
    try {
      await apiClient.delete(`/api/threads/${threadId}/messages/${msgId}`);
      setMessages((prev) => prev.filter((msg) => getMessageId(msg) !== msgId));
      setDeleteTarget(null);
    } catch (err: any) {
      setDeleteError(err?.response?.data?.error?.message || "Failed to delete message");
    } finally {
      setDeletingMessageId(null);
    }
  }

  async function openExpertDm(expertId: string) {
    if (!expertId || dmLoadingId) return;
    setDmLoadingId(expertId);
    setActionError(null);
    try {
      const res = await apiClient.post<{ conversation: { _id: string } }>(
        "/api/dms/conversations",
        { expertId }
      );
      router.push(`/dashboard/messages?conversation=${res.data.conversation._id}`);
    } catch (err: any) {
      setActionError(err?.response?.data?.error?.message || "Failed to start direct message");
    } finally {
      setDmLoadingId(null);
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
      <DashboardLayout title="Thread unavailable" searchPlaceholder="Search...">
        <div className="flex h-64 items-center justify-center text-center text-neutral-500">
          {loadError || "This thread could not be loaded."}
        </div>
      </DashboardLayout>
    );
  }

  const isAuthor = user?._id === (thread.createdBy as any)?._id ||
                   user?._id === String(thread.createdBy);
  const statusVariant = (STATUS_COLOR[thread.status] || "default") as any;
  const hasAI = !!thread.aiResponse;
  const hasExperts = thread.matchedExperts && thread.matchedExperts.length > 0;
  const similarProblems = thread.similarProblems || [];
  const hasSimilarProblems = similarProblems.length > 0;

  return (
    <DashboardLayout title={thread.title} searchPlaceholder="Search threads...">
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Message"
        description="This message will be removed from the thread."
        tone="danger"
        confirmLabel="Delete"
        cancelLabel="Keep"
        isLoading={Boolean(deletingMessageId)}
        icon={<Trash2 className="h-5 w-5" />}
        onCancel={() => {
          if (!deletingMessageId) setDeleteTarget(null);
        }}
        onConfirm={confirmDeleteMessage}
      />

      {loadError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          {loadError}
        </div>
      )}

      {/* Thread header */}
      <div className="mb-6 min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="info">{thread.subject.toUpperCase()}</Badge>
          <Badge variant={statusVariant}>
            {thread.status === "SOLVED" ? "Solved" : thread.status.replace("_", " ")}
          </Badge>
          {thread.tags.map((tag) => (
            <Badge key={tag} variant="default" className="text-xs">
              {tag}
            </Badge>
          ))}
          {isAuthor && (
            <button
              type="button"
              onClick={startTagEdit}
              className="min-h-[30px] rounded border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              Edit tags
            </button>
          )}
        </div>
        {isEditingTags && (
          <div className="mb-3 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
            <label className="mb-2 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Tags
            </label>
            <input
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              placeholder="mongodb, indexing, performance"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-primary-500 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
            />
            {tagError && <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{tagError}</p>}
            <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsEditingTags(false)}
                disabled={savingTags}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={saveTags} isLoading={savingTags}>
                Save tags
              </Button>
            </div>
          </div>
        )}
        <h1 className="break-words text-xl font-bold text-neutral-900 dark:text-white sm:text-2xl">{thread.title}</h1>
        {thread.body && (
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{thread.body}</p>
        )}
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        {/* ── Chat area (2/3) ─────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Messages */}
          <div className="flex min-h-[360px] max-h-[62dvh] flex-col gap-3 overflow-y-auto overflow-x-hidden rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50 sm:min-h-[400px] sm:p-4">
            {messages.map((msg) => {
              const msgId = getMessageId(msg);
              const isMe = user && (typeof msg.sender === "object"
                ? msg.sender._id === user._id
                : msg.sender === user._id);
              const canDelete = !!user && (
                !!isMe ||
                user.role === "admin" ||
                user.role === "mod"
              );
              const isSolutionMessage = thread.solutionMsgId === msgId;
              const isSys = msg.type === "SYSTEM_EVENT";
              const isAiMsg = msg.isFromAi;
              const hasUpvoted = !!user && (msg.upvotes || []).some((id) => String(id) === user._id);

              if (isSys) {
                return (
                  <div key={msgId} className="flex justify-center">
                    <div className="flex max-w-full items-center gap-2 break-words rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 sm:rounded-full sm:px-4">
                      <Video className="h-3.5 w-3.5" />
                      {msg.body}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msgId}
                  className={`flex min-w-0 gap-2 sm:gap-3 ${isMe ? "flex-row-reverse" : ""}`}
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
                  <div className={`flex min-w-0 max-w-[calc(100%-2.5rem)] flex-col gap-1 sm:max-w-[75%] ${isMe ? "items-end" : ""}`}>
                    <div className="flex max-w-full items-center gap-2">
                      <span className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        {isAiMsg ? "Mekari AI" : senderName(msg.sender)}
                      </span>
                      <span className="shrink-0 text-xs text-neutral-400">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {isSolutionMessage && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                          <CheckCircle className="h-3 w-3" />
                          Marked as answer
                        </span>
                      )}
                    </div>
                   <div className="group relative max-w-full">
  <div
    className={`max-w-full overflow-hidden rounded-xl px-4 py-2.5 text-sm ${
      isMe
        ? "bg-primary-600 text-white"
        : isAiMsg
        ? "border border-primary-200 bg-primary-50 text-neutral-900 dark:border-primary-800 dark:bg-primary-950/30 dark:text-neutral-100"
        : "border border-neutral-200 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
    }`}
  >
    {msg.parentMessageId && (
  <div className="mb-2 rounded-lg border-l-4 border-primary-500 bg-neutral-100 px-3 py-2 dark:bg-neutral-900/60">
    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary-500">
      Replying to
    </p>

    <p className="line-clamp-2 text-xs text-neutral-600 dark:text-neutral-400">
      {getParentMessage(msg.parentMessageId)?.body ?? "Original message"}
    </p>
  </div>
)}
    <MessageContent message={msg} />
    {isSolutionMessage && (
      <div className="mt-3 flex items-center gap-1.5 border-t border-emerald-200 pt-2 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300">
        <CheckCircle className="h-3.5 w-3.5" />
        This message was marked as the answer
      </div>
    )}
  </div>

  {isMe && msgId === latestOwnReadMessageId && (
    <div className="mt-1 flex items-center justify-end gap-1 text-[11px] font-medium text-primary-600 dark:text-primary-300">
      <CheckCheck className="h-3.5 w-3.5" />
      Seen
    </div>
  )}

  
  {!isAiMsg && (
    <div className="mt-1 flex flex-wrap items-center justify-end gap-2 rounded-lg text-xs sm:absolute sm:-top-3 sm:right-2 sm:mt-0 sm:hidden sm:border sm:border-neutral-200 sm:bg-white sm:px-2 sm:py-1 sm:shadow-md sm:group-hover:flex sm:dark:border-neutral-700 sm:dark:bg-neutral-900">
      
      
      <button
        type="button"
        onClick={() => startReply(msg)}
        className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-primary-500 hover:underline"
      >
        <Reply className="h-3 w-3" />
        Reply
      </button>

      <button
        type="button"
        onClick={() => upvoteMessage(msgId)}
        disabled={!!isMe || upvotingMessageId === msgId}
        className={`flex items-center gap-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 ${
          hasUpvoted
            ? "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            : "text-neutral-500 hover:text-green-400"
        }`}
        title={isMe ? "You cannot upvote your own message" : "Upvote message"}
      >
        <ArrowUp className="h-3.5 w-3.5" />
        {upvotingMessageId === msgId ? "..." : msg.upvotes?.length || 0}
      </button>

   
      {canDelete && !isSolutionMessage && (
        <button
          type="button"
          onClick={() => setDeleteTarget(msg)}
          disabled={deletingMessageId === msgId}
          className="text-xs text-neutral-500 hover:text-red-500 hover:underline"
          title="Delete message"
        >
          <span className="inline-flex items-center gap-1">
            <Trash2 className="h-3 w-3" />
            {deletingMessageId === msgId ? "Deleting..." : "Delete"}
          </span>
        </button>
      )}
    </div>
  )}
</div>
                    {/* Mark as solution button — only thread author, only non-AI, only unsolved */}
                    {isAuthor && !msg.isFromAi && thread.status !== "SOLVED" && !isMe && (
                      <button
                        onClick={() => markSolved(msgId)}
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
                {typingUsers.length === 1
                  ? `${typingUsers[0].name} is typing…`
                  : `${typingUsers.map((typingUser) => typingUser.name).join(", ")} are typing…`}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {(solveError || deleteError || actionError) && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
              {solveError || deleteError || actionError}
            </p>
          )}

          {/* Input bar */}
          {thread.status !== "CLOSED" && (
            <div className="flex flex-col gap-2">
              {replyTo && (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm dark:border-primary-900/50 dark:bg-primary-950/30">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-primary-700 dark:text-primary-300">
                      Replying to {senderName(replyTo.sender)}
                    </p>
                    <p className="truncate text-xs text-neutral-600 dark:text-neutral-400">
                      {replyTo.body}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="rounded p-1 text-neutral-500 hover:bg-white hover:text-neutral-800 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
                    aria-label="Cancel reply"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="rounded-xl border border-neutral-200 bg-white p-2 dark:border-neutral-700 dark:bg-neutral-900">
                <div className="mb-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setComposerMode((mode) => (mode === "CODE" ? "TEXT" : "CODE"))}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors sm:px-3 ${
                      composerMode === "CODE"
                        ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950"
                        : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    }`}
                    title="Send as code snippet"
                  >
                    <Code2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 sm:px-3"
                    title="Attach image"
                  >
                    <ImageIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 sm:px-3"
                    title="Attach file"
                  >
                    <Paperclip className="h-4 w-4" />
                    <span className="hidden sm:inline">File</span>
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker((value) => !value)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 sm:px-3"
                      title="Add emoji"
                    >
                      <Smile className="h-4 w-4" />
                      <span className="hidden sm:inline">Emoji</span>
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-11 left-0 z-20 grid grid-cols-4 gap-1 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                        {emojiOptions.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => addEmoji(emoji)}
                            className="flex h-9 w-9 items-center justify-center rounded text-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            aria-label={`Add ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => handleAttachmentChange(event, "IMAGE")}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => handleAttachmentChange(event, "FILE")}
                  />
                </div>

                {attachment && (
                  <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm dark:border-primary-900/50 dark:bg-primary-950/30">
                    <div className="flex min-w-0 items-center gap-2 text-primary-800 dark:text-primary-200">
                      {attachment.type === "IMAGE" ? (
                        <ImageIcon className="h-4 w-4 shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0" />
                      )}
                      <span className="truncate">{attachment.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={resetAttachment}
                      className="rounded p-1 text-primary-700 hover:bg-white dark:text-primary-200 dark:hover:bg-neutral-900"
                      aria-label="Remove attachment"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    rows={composerMode === "CODE" ? 5 : 2}
                    className="min-w-0 flex-1 resize-none rounded-lg border border-neutral-300 bg-white px-4 py-2.5 font-sans text-sm outline-none transition-colors focus:border-primary-500 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder-neutral-500"
                    placeholder={
                      composerMode === "CODE"
                        ? "Paste a code snippet..."
                        : attachment
                        ? "Add an optional caption..."
                        : replyTo
                        ? "Write a reply..."
                        : "Type your message..."
                    }
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && composerMode !== "CODE") {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    disabled={sending}
                  />
                  <Button
                    variant="primary"
                    size="md"
                    className="h-[42px] shrink-0 px-3 sm:px-4"
                    onClick={sendMessage}
                    disabled={(!input.trim() && !attachment) || sending}
                    isLoading={sending}
                    title="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── Side panels (1/3) ───────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Similar Problems panel */}
          {(
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <button
                className="flex w-full items-center justify-between px-4 py-3"
                onClick={() => setSimilarPanel((v) => !v)}
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                    Similar Problems
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
                    {similarLoading ? "..." : similarProblems.length}
                  </span>
                </div>
                {similarPanel ? (
                  <ChevronUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-emerald-500" />
                )}
              </button>

              {similarPanel && (
                <div className="border-t border-emerald-200/60 px-4 pb-4 pt-3 dark:border-emerald-900/40">
                  {similarLoading && !hasSimilarProblems ? (
                    <p className="text-sm text-emerald-800 dark:text-emerald-200">
                      Finding related solved threads...
                    </p>
                  ) : similarError ? (
                    <div className="space-y-3">
                      <p className="text-sm text-rose-700 dark:text-rose-300">{similarError}</p>
                      <Button variant="secondary" size="sm" onClick={loadSimilarProblems}>
                        Try again
                      </Button>
                    </div>
                  ) : !hasSimilarProblems ? (
                    <div className="space-y-3">
                      <p className="text-sm text-emerald-800 dark:text-emerald-200">
                        No similar solved problems found yet.
                      </p>
                      <Button variant="secondary" size="sm" onClick={loadSimilarProblems}>
                        Search again
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {similarProblems.map((problem) => (
                        <a
                          key={`${problem.docId}-${problem.threadId}`}
                          href={`/dashboard/threads/${problem.threadId}`}
                          className="block rounded-lg border border-emerald-200 bg-white p-3 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-neutral-900 dark:hover:bg-emerald-950/30"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                              {problem.title}
                            </p>
                            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
                              {Math.round(problem.combinedScore * 100)}%
                            </span>
                          </div>
                          {problem.threadSummary && (
                            <p className="mt-2 line-clamp-2 text-xs text-neutral-600 dark:text-neutral-400">
                              {problem.threadSummary}
                            </p>
                          )}
                          {problem.solution && (
                            <p className="mt-2 line-clamp-2 text-xs text-emerald-800 dark:text-emerald-200">
                              {problem.solution}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {problem.tags.slice(0, 4).map((tag) => (
                              <span
                                key={tag}
                                className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
                        className="flex items-start gap-3 border-b border-neutral-100 px-4 py-3 transition-colors last:border-0 hover:bg-neutral-50 dark:border-neutral-700/50 dark:hover:bg-neutral-900/50"
                      >
                        <Link
                          href={`/dashboard/profile/${id}`}
                          className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                          aria-label={`Open ${name}'s profile`}
                        >
                          <Avatar size="sm" initials={name.slice(0, 2).toUpperCase()} />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/dashboard/profile/${id}`}
                            className="text-sm font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-white"
                          >
                            {name}
                          </Link>
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
                        <button
                          type="button"
                          onClick={() => openExpertDm(id)}
                          disabled={Boolean(dmLoadingId)}
                          className="inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 disabled:cursor-wait disabled:opacity-60 dark:border-primary-900/50 dark:bg-primary-950/30 dark:text-primary-200 dark:hover:bg-primary-950/50"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {dmLoadingId === id ? "Opening" : "DM"}
                        </button>
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

function ConfirmDialog({
  open,
  title,
  description,
  tone = "default",
  confirmLabel,
  cancelLabel,
  isLoading,
  icon,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  tone?: "default" | "danger";
  confirmLabel: string;
  cancelLabel: string;
  isLoading?: boolean;
  icon: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  const accent =
    tone === "danger"
      ? "bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/50"
      : "bg-primary-50 text-primary-600 ring-primary-100 dark:bg-primary-950/40 dark:text-primary-300 dark:ring-primary-900/50";
  const confirmClass =
    tone === "danger"
      ? "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-400"
      : "bg-primary-600 text-white hover:bg-primary-700 disabled:bg-primary-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${accent}`}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-dialog-title" className="text-base font-bold text-neutral-900 dark:text-white">
              {title}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${confirmClass}`}
          >
            {isLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              icon
            )}
            {isLoading ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
