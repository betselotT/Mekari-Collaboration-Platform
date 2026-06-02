"use client";

import { ChangeEvent, FormEvent, ReactNode, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCheck,
  CheckCircle2,
  Code2,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  MessageCircle,
  Paperclip,
  PenLine,
  Reply,
  Send,
  Smile,
  Square,
  Trash2,
  Video,
  X,
} from "lucide-react";
import type { Socket } from "socket.io-client";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { SenderIdentityAvatar } from "../../../components/features/SenderIdentityAvatar";
import { MentionSuggestions, type MentionCandidate } from "../../../components/features/MentionSuggestions";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { apiClient } from "../../../lib/api";
import { useAuth } from "../../../lib/useAuth";
import { ensureSocket } from "../../../lib/useSocket";
import { useLanguage } from "../../../lib/i18n";

interface DmUser {
  _id: string;
  name: string;
  avatarUrl?: string;
  role: string;
  availabilityStatus?: string;
}

interface DmConversation {
  _id: string;
  participants: DmUser[];
  learner: DmUser;
  expert: DmUser;
  activeSession?: DmSession | null;
  unreadCount?: number;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  updatedAt: string;
}

interface DmSession {
  meetLink: string;
  meetSpaceName?: string;
  status: "creating" | "active" | "ended";
  startedBy: string;
  startedAt: string;
  endedBy?: string;
  endedAt?: string;
}

interface DmMessage {
  _id?: string;
  id?: string;
  conversation: string;
  sender: DmUser;
  body: string;
  type: "TEXT" | "CODE" | "IMAGE" | "FILE" | "SYSTEM_EVENT";
  attachmentUrl?: string;
  parentMessageId?: string;
  readBy?: Array<{
    user: string | DmUser;
    readAt: string;
  }>;
  editedAt?: string;
  createdAt: string;
}

type ComposerMode = "TEXT" | "CODE";

type AttachmentDraft = {
  type: "IMAGE" | "FILE";
  name: string;
  dataUrl: string;
};

function acceptsDm(status?: string) {
  return status === "available" || status === "online";
}

const emojiOptions = [
  "\u{1F44D}",
  "\u{1F64F}",
  "\u{1F389}",
  "\u{1F4A1}",
  "\u{2705}",
  "\u{1F525}",
  "\u{1F440}",
  "\u{1F680}",
  "\u{1F642}",
  "\u{1F4AF}",
  "\u{1F914}",
  "\u{1F4AA}",
];

function getId(value: { _id?: string; id?: string }) {
  return value._id || value.id || "";
}

function senderName(sender?: DmUser) {
  return sender?.name || "User";
}

function senderInitials(sender?: DmUser) {
  return senderName(sender)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function attachmentLabel(message: DmMessage, imageFallback: string, fileFallback: string) {
  return message.body || (message.type === "IMAGE" ? imageFallback : fileFallback);
}

function dataUrlToBlob(dataUrl: string) {
  const [header, data] = dataUrl.split(",");
  if (!header || !data) return null;
  const mime = header.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
  const binary = window.atob(data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}

function openAttachmentInNewTab(url: string) {
  if (url.startsWith("data:")) {
    const blob = dataUrlToBlob(url);
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function translatedSystemEvent(body: string, t: (key: string, values?: Record<string, string | number>) => string) {
  const started = body.match(/^Live session started\. Join here: (.+)$/);
  if (started) return t("Live session started. Join here: {link}", { link: started[1] });
  if (body === "Live session started") return t("Live session started");
  if (body === "Live session ended") return t("Live session ended");
  if (body === "Live session ended.") return t("Live session ended.");
  return body;
}

function readReceiptUserId(receipt: NonNullable<DmMessage["readBy"]>[number]) {
  return typeof receipt.user === "string" ? receipt.user : receipt.user?._id;
}

function normalizeId(value?: string | { _id?: string; id?: string } | null) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value._id || value.id || "";
}

function messageReadByUser(message: DmMessage, userId?: string) {
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

function MessageContent({
  message,
  onOpenImage,
}: {
  message: DmMessage;
  onOpenImage: (image: { src: string; alt: string }) => void;
}) {
  const { t } = useLanguage();

  if (message.type === "CODE") {
    return (
      <div className="max-w-full overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950 text-left">
        <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            {t("Code snippet")}
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
    const label = attachmentLabel(message, t("Shared image"), t("Attached file"));
    return (
      <figure className="space-y-2">
        <button
          type="button"
          onClick={() => onOpenImage({ src: message.attachmentUrl!, alt: label })}
          className="block max-w-full cursor-zoom-in text-left"
          title={t("Open image")}
        >
          <img
            src={message.attachmentUrl}
            alt={label}
            className="max-h-72 max-w-full rounded-lg border border-black/10 object-contain transition-opacity hover:opacity-90 dark:border-white/10"
          />
        </button>
        {message.body && <figcaption className="text-xs opacity-80">{message.body}</figcaption>}
      </figure>
    );
  }

  if (message.type === "FILE" && message.attachmentUrl) {
    const label = attachmentLabel(message, t("Shared image"), t("Attached file"));
    return (
      <button
        type="button"
        onClick={() => openAttachmentInNewTab(message.attachmentUrl!)}
        className="flex items-center gap-3 rounded-lg border border-current/15 bg-white/10 px-3 py-2 text-left hover:bg-white/15"
      >
        <FileText className="h-5 w-5 shrink-0" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{label}</span>
          <span className="block text-xs opacity-70">{t("Open attachment in a new tab")}</span>
        </span>
        <ExternalLink className="h-4 w-4 shrink-0 opacity-70" />
      </button>
    );
  }

  return <p className="whitespace-pre-wrap break-words">{message.body}</p>;
}

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesContent />
    </Suspense>
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
  const { t } = useLanguage();

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
            aria-label={t("Close dialog")}
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
            {isLoading ? t("Working...") : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function EndSessionDialog({
  open,
  isLoading,
  mentorName,
  onCancel,
  onEnd,
}: {
  open: boolean;
  isLoading: boolean;
  mentorName: string;
  onCancel: () => void;
  onEnd: (helpDelivered: boolean) => void;
}) {
  const { t } = useLanguage();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="end-session-title"
        className="w-full max-w-lg rounded-lg border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50">
            <Video className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="end-session-title" className="text-base font-bold text-neutral-900 dark:text-white">
              {t("End Live Session")}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {t("Confirm whether {name} delivered meaningful help during this session.", { name: mentorName })}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            aria-label={t("Close dialog")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onEnd(true)}
            disabled={isLoading}
            className="flex min-h-[92px] flex-col items-start justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-left transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
          >
            <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-200">
              {isLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {t("Mentor was helpful")}
            </span>
            <span className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
              {t("End session and confirm help was delivered.")}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onEnd(false)}
            disabled={isLoading}
            className="flex min-h-[92px] flex-col items-start justify-center rounded-lg border border-neutral-200 bg-white px-4 py-3 text-left transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          >
            <span className="inline-flex items-center gap-2 text-sm font-bold text-neutral-800 dark:text-neutral-100">
              {isLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {t("End without reward")}
            </span>
            <span className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              {t("End session without confirming mentor help.")}
            </span>
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="inline-flex min-h-[38px] items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {t("threads.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessagesContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedConversation = searchParams?.get("conversation") || "";
  const { user } = useAuth();
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [activeId, setActiveId] = useState(requestedConversation);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [composerMode, setComposerMode] = useState<ComposerMode>("TEXT");
  const [attachment, setAttachment] = useState<AttachmentDraft | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; name: string }>>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [joiningSession, setJoiningSession] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<DmMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<DmMessage | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DmMessage | null>(null);
  const [showEndSessionDialog, setShowEndSessionDialog] = useState(false);
  const [availabilityModalOpen, setAvailabilityModalOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ src: string; alt: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeIdRef = useRef(activeId);
  const readRequestKeyRef = useRef("");
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    setActiveId(requestedConversation);
  }, [requestedConversation]);

  async function loadConversations() {
    setLoadingConversations(true);
    setError(null);
    try {
      const res = await apiClient.get<{ conversations: DmConversation[] }>(
        "/api/dms/conversations"
      );
      const loaded = res.data.conversations || [];
      setConversations(loaded);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || "Failed to load conversations");
    } finally {
      setLoadingConversations(false);
    }
  }

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    activeIdRef.current = activeId;
    setTypingUsers([]);
    const socket = socketRef.current;
    if (socket && activeId) socket.emit("join_dm", activeId);
    return () => {
      if (socket && activeId) socket.emit("leave_dm", activeId);
    };
  }, [activeId]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    setError(null);
    apiClient
      .get<{ messages: DmMessage[] }>(`/api/dms/conversations/${activeId}/messages`)
      .then((res) => setMessages(res.data.messages || []))
      .catch((e) =>
        setError(e?.response?.data?.error?.message || "Failed to load messages")
      )
      .finally(() => setLoadingMessages(false));
  }, [activeId]);

  useEffect(() => {
    if (!user?._id) return;

    let mounted = true;
    let cleanup: (() => void) | null = null;

    const appendMessage = (message: DmMessage) => {
      setMessages((prev) => {
        const messageId = getId(message);
        if (messageId && prev.some((item) => getId(item) === messageId)) return prev;
        return [...prev, message];
      });
    };
    const handleNewMessage = (message: DmMessage) => {
      if (message.conversation !== activeIdRef.current) {
        loadConversations();
        return;
      }
      appendMessage(message);
    };
    const handleConversationUpdated = (data?: {
      conversationId?: string;
      message?: DmMessage;
      deletedMessageId?: string;
      editedMessage?: DmMessage;
      session?: DmSession | null;
    }) => {
      if (data?.conversationId && "session" in data) {
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation._id === data.conversationId
              ? { ...conversation, activeSession: data.session }
              : conversation
          )
        );
      }
      if (data?.conversationId === activeIdRef.current && data.message) {
        appendMessage(data.message);
      }
      if (data?.conversationId === activeIdRef.current && data.deletedMessageId) {
        setMessages((prev) => prev.filter((message) => getId(message) !== data.deletedMessageId));
      }
      if (data?.conversationId === activeIdRef.current && data.editedMessage) {
        setMessages((prev) =>
          prev.map((message) =>
            getId(message) === getId(data.editedMessage!) ? { ...message, ...data.editedMessage! } : message
          )
        );
      }
      loadConversations();
    };
    const handleDeleted = (data: { conversationId: string; messageId: string }) => {
      if (data.conversationId !== activeIdRef.current) return;
      setMessages((prev) => prev.filter((message) => getId(message) !== data.messageId));
    };
    const handleEdited = (data: { conversationId: string; message: DmMessage }) => {
      if (data.conversationId !== activeIdRef.current) return;
      setMessages((prev) =>
        prev.map((message) => (getId(message) === getId(data.message) ? { ...message, ...data.message } : message))
      );
    };
    const handleTyping = (data: { conversationId: string; userId: string; userName?: string }) => {
      const senderId = normalizeId(data.userId);
      const currentUserId = normalizeId(user);
      if (data.conversationId !== activeIdRef.current || senderId === currentUserId) return;
      const conversation = conversations.find((item) => item._id === data.conversationId);
      const participant = conversation?.participants.find(
        (item) => normalizeId(item) === senderId
      );
      const typingName = data.userName || participant?.name || "Someone";
      setTypingUsers((prev) =>
        prev.some((item) => item.userId === senderId)
          ? prev.map((item) =>
              item.userId === senderId ? { ...item, name: typingName } : item
            )
          : [...prev, { userId: senderId, name: typingName }]
      );
    };
    const handleStoppedTyping = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId !== activeIdRef.current) return;
      const senderId = normalizeId(data.userId);
      setTypingUsers((prev) => prev.filter((item) => item.userId !== senderId));
    };
    const handleSessionUpdated = (data: {
      conversationId: string;
      session: DmSession | null;
      message?: DmMessage;
    }) => {
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation._id === data.conversationId
            ? { ...conversation, activeSession: data.session }
            : conversation
        )
      );
      if (data.conversationId === activeIdRef.current && data.message) {
        appendMessage(data.message);
      }
    };
    const handleMessagesRead = (data: {
      conversationId: string;
      userId: string;
      messageIds: string[];
      readAt: string;
    }) => {
      if (normalizeId(data.userId) === normalizeId(user)) {
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation._id === data.conversationId ? { ...conversation, unreadCount: 0 } : conversation
          )
        );
      }
      if (data.conversationId !== activeIdRef.current || data.messageIds.length === 0) return;
      const readMessageIds = new Set(data.messageIds);
      setMessages((prev) =>
        prev.map((message) => {
          const messageId = getId(message);
          if (!readMessageIds.has(messageId) || messageReadByUser(message, data.userId)) {
            return message;
          }
          return {
            ...message,
            readBy: [...(message.readBy || []), { user: data.userId, readAt: data.readAt }],
          };
        })
      );
    };
    const handleWhiteboardOpened = (data: { conversationId?: string; openedBy?: string }) => {
      if (!data.conversationId || data.openedBy === user._id) return;
      router.push(`/dashboard/whiteboard?conversation=${encodeURIComponent(data.conversationId)}`);
    };

    ensureSocket().then((socket) => {
      if (!mounted) return;
      socketRef.current = socket;
      const joinActive = () => {
        if (activeIdRef.current) socket.emit("join_dm", activeIdRef.current);
      };
      joinActive();
      socket.on("connect", joinActive);
      socket.on("new_dm_message", handleNewMessage);
      socket.on("dm_conversation_updated", handleConversationUpdated);
      socket.on("dm_message_deleted", handleDeleted);
      socket.on("dm_message_edited", handleEdited);
      socket.on("dm_user_typing", handleTyping);
      socket.on("dm_user_stopped_typing", handleStoppedTyping);
      socket.on("dm_session_updated", handleSessionUpdated);
      socket.on("dm_messages_read", handleMessagesRead);
      socket.on("dm_whiteboard_opened", handleWhiteboardOpened);
      cleanup = () => {
        if (activeIdRef.current) socket.emit("leave_dm", activeIdRef.current);
        socket.off("connect", joinActive);
        socket.off("new_dm_message", handleNewMessage);
        socket.off("dm_conversation_updated", handleConversationUpdated);
        socket.off("dm_message_deleted", handleDeleted);
        socket.off("dm_message_edited", handleEdited);
        socket.off("dm_user_typing", handleTyping);
        socket.off("dm_user_stopped_typing", handleStoppedTyping);
        socket.off("dm_session_updated", handleSessionUpdated);
        socket.off("dm_messages_read", handleMessagesRead);
        socket.off("dm_whiteboard_opened", handleWhiteboardOpened);
      };
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation._id === activeId) || null,
    [activeId, conversations]
  );
  const mentionCandidates = useMemo<MentionCandidate[]>(
    () => activeConversation?.participants || [],
    [activeConversation]
  );

  const latestOwnReadMessageId = useMemo(() => {
    if (!activeConversation || !user?._id) return "";
    const otherId = otherParticipant(activeConversation)?._id;
    if (!otherId) return "";

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (
        message.type !== "SYSTEM_EVENT" &&
        message.sender?._id === user._id &&
        messageReadByUser(message, otherId)
      ) {
        return getId(message);
      }
    }
    return "";
  }, [activeConversation, messages, user?._id]);

  useEffect(() => {
    if (!activeId || !user?._id) return;

    const unreadIncomingIds = messages
      .filter(
        (message) =>
          message.type !== "SYSTEM_EVENT" &&
          message.sender?._id !== user._id &&
          !messageReadByUser(message, user._id)
      )
      .map(getId)
      .filter(Boolean);

    if (unreadIncomingIds.length === 0) return;

    const requestKey = `${activeId}:${unreadIncomingIds.join(",")}`;
    if (readRequestKeyRef.current === requestKey) return;
    readRequestKeyRef.current = requestKey;

    apiClient
      .post(`/api/dms/conversations/${activeId}/read`)
      .catch(() => {
        readRequestKeyRef.current = "";
      });
  }, [activeId, messages, user?._id]);

  function otherParticipant(conversation: DmConversation) {
    return (
      conversation.participants.find((participant) => participant._id !== user?._id) ||
      conversation.expert ||
      conversation.participants[0]
    );
  }

  function selectConversation(conversationId: string) {
    setActiveId(conversationId);
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation._id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
      )
    );
    setReplyTo(null);
    setMentionedUserIds([]);
    setShowEmojiPicker(false);
    router.replace(`/dashboard/messages?conversation=${conversationId}`);
  }

  function showConversationList() {
    setActiveId("");
    setReplyTo(null);
    setMentionedUserIds([]);
    setShowEmojiPicker(false);
    router.replace("/dashboard/messages");
  }

  function getParentMessage(parentMessageId?: string) {
    if (!parentMessageId) return null;
    return messages.find((message) => getId(message) === String(parentMessageId)) || null;
  }

  function startReply(message: DmMessage) {
    if (message.type === "SYSTEM_EVENT") return;
    setReplyTo(message);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function startEdit(message: DmMessage) {
    if (message.type === "SYSTEM_EVENT" || message.type === "IMAGE" || message.type === "FILE") return;
    setEditingMessage(message);
    setEditDraft(message.body);
    setError(null);
  }

  async function saveMessageEdit() {
    const messageId = editingMessage ? getId(editingMessage) : "";
    const body = editDraft.trim();
    if (!activeId || !messageId || !body || savingEditId) return;

    setSavingEditId(messageId);
    setError(null);
    try {
      const res = await apiClient.patch<{ message: DmMessage }>(
        `/api/dms/conversations/${activeId}/messages/${messageId}`,
        { body }
      );
      setMessages((prev) =>
        prev.map((message) =>
          getId(message) === messageId ? { ...message, ...res.data.message } : message
        )
      );
      setEditingMessage(null);
      setEditDraft("");
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || "Failed to edit message");
    } finally {
      setSavingEditId(null);
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    const socket = socketRef.current;
    if (!socket || !activeId) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("dm_typing_start", activeId);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit("dm_typing_stop", activeId);
    }, 2000);
  }

  function addEmoji(emoji: string) {
    handleDraftChange(`${draft}${emoji}`);
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
      setError("Attachments must be 4MB or smaller.");
      event.target.value = "";
      return;
    }

    if (kind === "IMAGE" && !file.type.startsWith("image/")) {
      setError("Choose an image file for image messages.");
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
      setError(null);
      if (!draft.trim()) handleDraftChange(file.name);
    };
    reader.onerror = () => setError("Could not read the selected attachment.");
    reader.readAsDataURL(file);
  }

  async function submitMessage() {
    const body = draft.trim();
    if ((!body && !attachment) || !activeId || sending) return;

    if (
      activeConversation &&
      user?._id === activeConversation.learner?._id &&
      !acceptsDm(activeConversation.expert?.availabilityStatus)
    ) {
      setAvailabilityModalOpen(true);
      return;
    }

    setSending(true);
    setError(null);
    const parentMessageId = replyTo ? getId(replyTo) : undefined;
    const selectedMentionIds = mentionedUserIds;
    const messageType = attachment?.type || composerMode;
    const messageBody = body || attachment?.name || "Attachment";
    const attachmentUrl = attachment?.dataUrl;
    try {
      const res = await apiClient.post<{ message: DmMessage }>(
        `/api/dms/conversations/${activeId}/messages`,
        { body: messageBody, type: messageType, attachmentUrl, parentMessageId, mentionedUserIds: selectedMentionIds }
      );
      setMessages((prev) => {
        const messageId = getId(res.data.message);
        if (messageId && prev.some((message) => getId(message) === messageId)) return prev;
        return [...prev, res.data.message];
      });
      socketRef.current?.emit("dm_typing_stop", activeId);
      isTypingRef.current = false;
      setDraft("");
      setMentionedUserIds([]);
      setComposerMode("TEXT");
      setShowEmojiPicker(false);
      resetAttachment();
      setReplyTo(null);
    } catch (e: any) {
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.error?.message ||
        "Failed to send message";
      if (message === "Mentor isn't available right now. Try again later.") {
        setAvailabilityModalOpen(true);
      } else {
        setError(message);
      }
    } finally {
      setSending(false);
    }
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    submitMessage();
  }

  async function confirmDeleteMessage() {
    const messageId = deleteTarget ? getId(deleteTarget) : "";
    if (!activeId || !messageId || deletingMessageId) return;
    setDeletingMessageId(messageId);
    setError(null);
    try {
      await apiClient.delete(`/api/dms/conversations/${activeId}/messages/${messageId}`);
      setMessages((prev) => prev.filter((message) => getId(message) !== messageId));
      if (replyTo && getId(replyTo) === messageId) setReplyTo(null);
      setDeleteTarget(null);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || "Failed to delete message");
    } finally {
      setDeletingMessageId(null);
    }
  }

  async function startSession() {
    if (!activeId || creatingSession) return;
    setCreatingSession(true);
    setError(null);
    try {
      const res = await apiClient.post<{ session: DmSession; message?: DmMessage }>(
        `/api/dms/conversations/${activeId}/session`
      );
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation._id === activeId
            ? { ...conversation, activeSession: res.data.session }
            : conversation
        )
      );
      if (res.data.message) {
        setMessages((prev) => {
          const messageId = getId(res.data.message!);
          if (messageId && prev.some((message) => getId(message) === messageId)) return prev;
          return [...prev, res.data.message!];
        });
      }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || t("Failed to create the live session"));
    } finally {
      setCreatingSession(false);
    }
  }

  async function joinSession() {
    if (!activeId || joiningSession) return;
    setJoiningSession(true);
    setError(null);
    try {
      const res = await apiClient.get<{ session: DmSession }>(
        `/api/dms/conversations/${activeId}/session`
      );
      window.open(res.data.session.meetLink, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || t("Failed to open the live session"));
    } finally {
      setJoiningSession(false);
    }
  }

  function openWhiteboard() {
    if (!activeId) return;
    socketRef.current?.emit("open_dm_whiteboard", activeId);
    router.push(`/dashboard/whiteboard?conversation=${encodeURIComponent(activeId)}`);
  }

  async function endSession(helpDelivered: boolean) {
    if (!activeId || endingSession) return;
    setEndingSession(true);
    setError(null);
    try {
      const res = await apiClient.post<{ session: DmSession; message?: DmMessage }>(
        `/api/dms/conversations/${activeId}/session/end`,
        { helpDelivered }
      );
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation._id === activeId
            ? { ...conversation, activeSession: res.data.session }
            : conversation
        )
      );
      if (res.data.message) {
        setMessages((prev) => {
          const messageId = getId(res.data.message!);
          if (messageId && prev.some((message) => getId(message) === messageId)) return prev;
          return [...prev, res.data.message!];
        });
      }
      setShowEndSessionDialog(false);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || t("Failed to end the live session"));
    } finally {
      setEndingSession(false);
    }
  }

  return (
    <DashboardLayout title={t("Messages")} searchPlaceholder={t("Search messages...")}>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t("Delete Message")}
        description={t("This message will be removed from the conversation.")}
        tone="danger"
        confirmLabel={t("Delete")}
        cancelLabel={t("Keep")}
        isLoading={Boolean(deletingMessageId)}
        icon={<Trash2 className="h-5 w-5" />}
        onCancel={() => {
          if (!deletingMessageId) setDeleteTarget(null);
        }}
        onConfirm={confirmDeleteMessage}
      />

      <ConfirmDialog
        open={availabilityModalOpen}
        title={t("Mentor unavailable")}
        description={t("Mentor isn't available right now. Try again later.")}
        confirmLabel={t("OK")}
        cancelLabel={t("Close")}
        icon={<AlertTriangle className="h-5 w-5" />}
        onCancel={() => setAvailabilityModalOpen(false)}
        onConfirm={() => setAvailabilityModalOpen(false)}
      />

      <EndSessionDialog
        open={showEndSessionDialog}
        isLoading={endingSession}
        mentorName={activeConversation?.expert?.name || "mentor"}
        onCancel={() => {
          if (!endingSession) setShowEndSessionDialog(false);
        }}
        onEnd={(helpDelivered) => endSession(helpDelivered)}
      />

      <div className="mb-6 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary-600" />
        <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
          {t("Private direct messages")}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="grid h-[calc(100dvh-156px)] min-h-0 min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900 sm:h-[calc(100dvh-180px)] lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <aside className={`${activeConversation ? "hidden lg:flex" : "flex"} min-h-0 flex-col border-b border-neutral-200 dark:border-neutral-700 lg:border-b-0 lg:border-r`}>
          <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white">{t("Conversations")}</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingConversations ? (
              <div className="p-4 text-sm text-neutral-500">{t("Loading conversations...")}</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">{t("No private conversations yet.")}</div>
            ) : (
              conversations.map((conversation) => {
                const other = otherParticipant(conversation);
                const isActive = conversation._id === activeId;
                const unreadCount = conversation.unreadCount || 0;
                const isUnread = unreadCount > 0 && !isActive;
                return (
                  <button
                    key={conversation._id}
                    type="button"
                    onClick={() => selectConversation(conversation._id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isActive
                        ? "bg-primary-50 dark:bg-primary-950/40"
                        : isUnread
                          ? "bg-red-50/50 hover:bg-red-50 dark:bg-red-950/10 dark:hover:bg-red-950/20"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <Avatar
                      size="sm"
                      src={other?.avatarUrl}
                      initials={(other?.name || "DM").slice(0, 2).toUpperCase()}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm text-neutral-900 dark:text-white ${isUnread ? "font-extrabold" : "font-semibold"}`}>
                        {other?.name || t("Conversation")}
                      </span>
                      <span className={`block truncate text-xs ${isUnread ? "font-bold text-neutral-800 dark:text-neutral-100" : "text-neutral-500 dark:text-neutral-400"}`}>
                        {conversation.lastMessagePreview
                          ? translatedSystemEvent(conversation.lastMessagePreview, t)
                          : t("Private conversation")}
                      </span>
                    </span>
                    {isUnread && (
                      <span className="min-w-5 shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className={`${activeConversation ? "flex" : "hidden lg:flex"} min-h-0 min-w-0 flex-col overflow-hidden`}>
          {activeConversation ? (
            <>
              <div className="flex flex-col gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-700 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={showConversationList}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 lg:hidden"
                    aria-label={t("Back to conversations")}
                    title={t("Back to conversations")}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <Avatar
                    size="sm"
                    src={otherParticipant(activeConversation)?.avatarUrl}
                    initials={(otherParticipant(activeConversation)?.name || "DM").slice(0, 2).toUpperCase()}
                  />
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-neutral-900 dark:text-white">
                      {otherParticipant(activeConversation)?.name || t("Conversation")}
                    </h2>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {t("One-on-one private DM")}
                    </p>
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                  <span className="hidden text-xs font-medium text-neutral-500 dark:text-neutral-400 sm:inline">
                    {t("Need deeper discussion?")}
                  </span>
                  {activeConversation.activeSession?.status === "active" ? (
                    <div className="flex w-full flex-col gap-2 min-[380px]:flex-row sm:w-auto">
                      <button
                        type="button"
                        onClick={joinSession}
                        disabled={joiningSession}
                        className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none"
                      >
                        {joiningSession ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Video className="h-4 w-4" />
                        )}
                        {joiningSession ? t("Opening...") : t("Rejoin")}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEndSessionDialog(true)}
                        disabled={endingSession}
                        className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/60 dark:bg-neutral-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                      >
                        {endingSession ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                        {t("End")}
                      </button>
                      <button
                        type="button"
                        onClick={openWhiteboard}
                        className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-primary-200 bg-white px-3 py-2 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50 dark:border-primary-900/60 dark:bg-neutral-900 dark:text-primary-300 dark:hover:bg-primary-950/30"
                      >
                        <PenLine className="h-4 w-4" />
                        {t("Whiteboard")}
                      </button>
                    </div>
                  ) : (
                    <div className="flex w-full flex-col gap-2 min-[380px]:flex-row sm:w-auto">
                      <button
                        type="button"
                        onClick={startSession}
                        disabled={creatingSession || activeConversation.activeSession?.status === "creating"}
                        className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-900/10 transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-500 disabled:opacity-80 sm:w-auto"
                      >
                        {creatingSession || activeConversation.activeSession?.status === "creating" ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Video className="h-4 w-4" />
                        )}
                        {creatingSession || activeConversation.activeSession?.status === "creating"
                          ? t("Creating...")
                          : t("Start Session")}
                      </button>
                      <button
                        type="button"
                        onClick={openWhiteboard}
                        className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-primary-200 bg-white px-3 py-2 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50 dark:border-primary-900/60 dark:bg-neutral-900 dark:text-primary-300 dark:hover:bg-primary-950/30"
                      >
                        <PenLine className="h-4 w-4" />
                        {t("Whiteboard")}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden bg-neutral-50 p-3 dark:bg-neutral-950 sm:p-4">
                {loadingMessages ? (
                  <div className="text-sm text-neutral-500">{t("Loading messages...")}</div>
                ) : messages.length === 0 ? (
                  <div className="text-sm text-neutral-500">
                    {t("Start the conversation with a private message.")}
                  </div>
                ) : (
                  messages.map((message) => {
                    const messageId = getId(message);
                    const isMine = message.sender?._id === user?._id;
                    const isSystemEvent = message.type === "SYSTEM_EVENT";
                    const parent = getParentMessage(message.parentMessageId);
                    const isLatestSeenOwnMessage =
                      isMine && messageId === latestOwnReadMessageId;
                    const isEditingThisMessage = editingMessage ? getId(editingMessage) === messageId : false;
                    const canEdit = isMine && (message.type === "TEXT" || message.type === "CODE");
                    if (isSystemEvent) {
                      return (
                        <div key={messageId} className="flex justify-center">
                          <div className="max-w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200 sm:max-w-[90%]">
                            {translatedSystemEvent(message.body, t)}
                          </div>
                        </div>
                      );
                    }
                    return (
                    <div key={messageId} className={`flex min-w-0 gap-2 sm:gap-3 ${isMine ? "flex-row-reverse" : ""}`}>
                        <SenderIdentityAvatar
                          sender={message.sender}
                          initials={senderInitials(message.sender)}
                          align={isMine ? "right" : "left"}
                        />
                        <div className={`flex min-w-0 max-w-[calc(100%-2.5rem)] flex-col gap-1 sm:max-w-[75%] ${isMine ? "items-end" : ""}`}>
                          <div className="flex max-w-full items-center gap-2">
                            <span className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">
                              {senderName(message.sender)}
                            </span>
                            <span className="shrink-0 text-xs text-neutral-400">
                              {new Date(message.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="group relative max-w-full">
                            <div
                              className={`max-w-full overflow-hidden rounded-xl px-4 py-2.5 text-sm ${
                                isMine
                                  ? "bg-primary-600 text-white"
                                  : "border border-neutral-200 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                              }`}
                            >
                              {message.parentMessageId && (
                                <div className="mb-2 rounded-lg border-l-4 border-primary-500 bg-neutral-100 px-3 py-2 dark:bg-neutral-900/60">
                                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary-500">
                                    {t("Replying to")}
                                  </p>
                                  <p className="line-clamp-2 text-xs text-neutral-600 dark:text-neutral-400">
                                    {parent?.body ?? t("Original message")}
                                  </p>
                                </div>
                              )}
                              {isEditingThisMessage ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editDraft}
                                    onChange={(event) => setEditDraft(event.target.value)}
                                    rows={message.type === "CODE" ? 5 : 3}
                                    className="w-full min-w-[240px] resize-none rounded-lg border border-primary-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-primary-500 dark:border-primary-700 dark:bg-neutral-950 dark:text-neutral-100"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingMessage(null);
                                        setEditDraft("");
                                      }}
                                      disabled={savingEditId === messageId}
                                      className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                                    >
                                      {t("threads.cancel")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={saveMessageEdit}
                                      disabled={!editDraft.trim() || savingEditId === messageId}
                                      className="rounded-md bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {savingEditId === messageId ? t("Saving...") : t("Save")}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <MessageContent message={message} onOpenImage={setImagePreview} />
                              )}
                              {message.editedAt && !isEditingThisMessage && (
                      <div className="mt-1 text-[11px] font-medium opacity-70">{t("edited")}</div>
                              )}
                            </div>
                            {isLatestSeenOwnMessage && (
                              <div className="mt-1 flex items-center justify-end gap-1 text-[11px] font-medium text-primary-600 dark:text-primary-300">
                                <CheckCheck className="h-3.5 w-3.5" />
                                {t("Seen")}
                              </div>
                            )}

                            <div className="mt-1 flex flex-wrap items-center justify-end gap-2 rounded-lg text-xs sm:absolute sm:-top-3 sm:right-2 sm:mt-0 sm:hidden sm:border sm:border-neutral-200 sm:bg-white sm:px-2 sm:py-1 sm:shadow-md sm:group-hover:flex sm:dark:border-neutral-700 sm:dark:bg-neutral-900">
                              <button
                                type="button"
                                onClick={() => startReply(message)}
                                className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-primary-500 hover:underline"
                              >
                                <Reply className="h-3 w-3" />
                                {t("Reply")}
                              </button>
                              {canEdit && !isEditingThisMessage && (
                                <button
                                  type="button"
                                  onClick={() => startEdit(message)}
                                  className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-primary-500 hover:underline"
                                >
                                  <PenLine className="h-3 w-3" />
                                  {t("Edit")}
                                </button>
                              )}
                              {isMine && (
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(message)}
                                  disabled={deletingMessageId === messageId}
                                  className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-red-500 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  {deletingMessageId === messageId ? t("Deleting...") : t("Delete")}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {typingUsers.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <div className="flex gap-0.5">
                      <span className="animate-bounce">.</span>
                      <span className="animate-bounce [animation-delay:0.1s]">.</span>
                      <span className="animate-bounce [animation-delay:0.2s]">.</span>
                    </div>
                    {typingUsers.length === 1
                      ? t("{name} is typing...", { name: typingUsers[0].name })
                      : t("{names} are typing...", { names: typingUsers.map((typingUser) => typingUser.name).join(", ") })}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={sendMessage} className="flex flex-col gap-2 border-t border-neutral-200 p-3 dark:border-neutral-700 sm:p-4">
                {replyTo && (
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm dark:border-primary-900/50 dark:bg-primary-950/30">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-primary-700 dark:text-primary-300">
                        {t("Replying to {name}", { name: senderName(replyTo.sender) })}
                      </p>
                      <p className="truncate text-xs text-neutral-600 dark:text-neutral-400">
                        {replyTo.body}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="rounded p-1 text-neutral-500 hover:bg-white hover:text-neutral-800 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
                    aria-label={t("Cancel reply")}
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
                    title={t("Send as code snippet")}
                    >
                      <Code2 className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("Code")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 sm:px-3"
                    title={t("Attach image")}
                    >
                      <ImageIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("Image")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 sm:px-3"
                    title={t("Attach file")}
                    >
                      <Paperclip className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("File")}</span>
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker((value) => !value)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 sm:px-3"
                      title={t("Add emoji")}
                      >
                        <Smile className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("Emoji")}</span>
                      </button>
                      {showEmojiPicker && (
                        <div className="absolute bottom-11 left-0 z-30 w-52 rounded-lg border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 sm:w-60">
                          <div className="grid grid-cols-6 gap-1">
                            {emojiOptions.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => addEmoji(emoji)}
                                className="flex h-8 w-8 items-center justify-center rounded text-lg leading-none transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 sm:h-9 sm:w-9"
                                aria-label={`Add ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
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
                      aria-label={t("Remove attachment")}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  <div className="relative flex items-end gap-2">
                    <MentionSuggestions
                      candidates={mentionCandidates}
                      currentUserId={user?._id}
                      value={draft}
                      onSelect={(value, userId) => {
                        handleDraftChange(value);
                        setMentionedUserIds((current) => [...new Set([...current, userId])]);
                        requestAnimationFrame(() => inputRef.current?.focus());
                      }}
                    />
                    <textarea
                      ref={inputRef}
                      rows={composerMode === "CODE" ? 5 : 2}
                      value={draft}
                      onChange={(event) => handleDraftChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey && composerMode !== "CODE") {
                          event.preventDefault();
                          submitMessage();
                        }
                      }}
                      placeholder={
                        composerMode === "CODE"
                          ? t("Paste a code snippet...")
                          : attachment
                          ? t("Add an optional caption...")
                          : replyTo
                          ? t("Write a reply...")
                          : t("Type a private message...")
                      }
                      className="min-w-0 flex-1 resize-none rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
                      disabled={sending}
                    />
                    <Button type="submit" variant="primary" size="md" className="h-[42px] shrink-0 px-3 sm:px-4" disabled={(!draft.trim() && !attachment) || sending}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-neutral-500">
              {t("Select a conversation or start one from an expert profile.")}
            </div>
          )}
        </section>
      </div>
      {imagePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/90 px-4 py-6">
          <button
            type="button"
            onClick={() => setImagePreview(null)}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label={t("Close image")}
            title={t("Close image")}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={imagePreview.src}
            alt={imagePreview.alt}
            className="max-h-[calc(100dvh-4rem)] max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </DashboardLayout>
  );
}
