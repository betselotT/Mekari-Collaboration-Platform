"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageCircle, Reply, Send, Trash2, X } from "lucide-react";
import type { Socket } from "socket.io-client";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { apiClient } from "../../../lib/api";
import { useAuth } from "../../../lib/useAuth";
import { ensureSocket } from "../../../lib/useSocket";

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
  lastMessagePreview?: string;
  lastMessageAt?: string;
  updatedAt: string;
}

interface DmMessage {
  _id?: string;
  id?: string;
  conversation: string;
  sender: DmUser;
  body: string;
  type: "TEXT";
  parentMessageId?: string;
  createdAt: string;
}

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

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesContent />
    </Suspense>
  );
}

function MessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedConversation = searchParams?.get("conversation") || "";
  const { user } = useAuth();
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [activeId, setActiveId] = useState(requestedConversation);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<DmMessage | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeIdRef = useRef(activeId);
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
      if (!activeIdRef.current && loaded[0]) {
        setActiveId(loaded[0]._id);
        router.replace(`/dashboard/messages?conversation=${loaded[0]._id}`);
      }
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
    }) => {
      if (data?.conversationId === activeIdRef.current && data.message) {
        appendMessage(data.message);
      }
      if (data?.conversationId === activeIdRef.current && data.deletedMessageId) {
        setMessages((prev) => prev.filter((message) => getId(message) !== data.deletedMessageId));
      }
      loadConversations();
    };
    const handleDeleted = (data: { conversationId: string; messageId: string }) => {
      if (data.conversationId !== activeIdRef.current) return;
      setMessages((prev) => prev.filter((message) => getId(message) !== data.messageId));
    };
    const handleTyping = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId !== activeIdRef.current || data.userId === user._id) return;
      setTypingUsers((prev) => (prev.includes(data.userId) ? prev : [...prev, data.userId]));
    };
    const handleStoppedTyping = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId !== activeIdRef.current) return;
      setTypingUsers((prev) => prev.filter((id) => id !== data.userId));
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
      socket.on("dm_user_typing", handleTyping);
      socket.on("dm_user_stopped_typing", handleStoppedTyping);
      cleanup = () => {
        if (activeIdRef.current) socket.emit("leave_dm", activeIdRef.current);
        socket.off("connect", joinActive);
        socket.off("new_dm_message", handleNewMessage);
        socket.off("dm_conversation_updated", handleConversationUpdated);
        socket.off("dm_message_deleted", handleDeleted);
        socket.off("dm_user_typing", handleTyping);
        socket.off("dm_user_stopped_typing", handleStoppedTyping);
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

  function otherParticipant(conversation: DmConversation) {
    return (
      conversation.participants.find((participant) => participant._id !== user?._id) ||
      conversation.expert ||
      conversation.participants[0]
    );
  }

  function selectConversation(conversationId: string) {
    setActiveId(conversationId);
    setReplyTo(null);
    router.replace(`/dashboard/messages?conversation=${conversationId}`);
  }

  function getParentMessage(parentMessageId?: string) {
    if (!parentMessageId) return null;
    return messages.find((message) => getId(message) === String(parentMessageId)) || null;
  }

  function startReply(message: DmMessage) {
    setReplyTo(message);
    requestAnimationFrame(() => inputRef.current?.focus());
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

  async function submitMessage() {
    const body = draft.trim();
    if (!body || !activeId || sending) return;

    setSending(true);
    setError(null);
    const parentMessageId = replyTo ? getId(replyTo) : undefined;
    try {
      const res = await apiClient.post<{ message: DmMessage }>(
        `/api/dms/conversations/${activeId}/messages`,
        { body, parentMessageId }
      );
      setMessages((prev) => {
        const messageId = getId(res.data.message);
        if (messageId && prev.some((message) => getId(message) === messageId)) return prev;
        return [...prev, res.data.message];
      });
      socketRef.current?.emit("dm_typing_stop", activeId);
      isTypingRef.current = false;
      setDraft("");
      setReplyTo(null);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          e?.response?.data?.error?.message ||
          "Failed to send message"
      );
    } finally {
      setSending(false);
    }
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    submitMessage();
  }

  async function deleteMessage(messageId: string) {
    if (!activeId || !messageId || deletingMessageId) return;
    const confirmed = window.confirm("Delete this message?");
    if (!confirmed) return;
    setDeletingMessageId(messageId);
    setError(null);
    try {
      await apiClient.delete(`/api/dms/conversations/${activeId}/messages/${messageId}`);
      setMessages((prev) => prev.filter((message) => getId(message) !== messageId));
      if (replyTo && getId(replyTo) === messageId) setReplyTo(null);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || "Failed to delete message");
    } finally {
      setDeletingMessageId(null);
    }
  }

  return (
    <DashboardLayout title="Messages" searchPlaceholder="Search messages...">
      <div className="mb-6 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary-600" />
        <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
          PRIVATE DIRECT MESSAGES
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="grid min-h-[calc(100vh-180px)] overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900 lg:grid-cols-[320px_1fr]">
        <aside className="border-b border-neutral-200 dark:border-neutral-700 lg:border-b-0 lg:border-r">
          <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white">Conversations</h2>
          </div>
          <div className="max-h-[320px] overflow-y-auto lg:max-h-[calc(100vh-232px)]">
            {loadingConversations ? (
              <div className="p-4 text-sm text-neutral-500">Loading conversations...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">No private conversations yet.</div>
            ) : (
              conversations.map((conversation) => {
                const other = otherParticipant(conversation);
                const isActive = conversation._id === activeId;
                return (
                  <button
                    key={conversation._id}
                    type="button"
                    onClick={() => selectConversation(conversation._id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isActive
                        ? "bg-primary-50 dark:bg-primary-950/40"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <Avatar
                      size="sm"
                      src={other?.avatarUrl}
                      initials={(other?.name || "DM").slice(0, 2).toUpperCase()}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-neutral-900 dark:text-white">
                        {other?.name || "Conversation"}
                      </span>
                      <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {conversation.lastMessagePreview || "Private conversation"}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex min-h-[520px] flex-col">
          {activeConversation ? (
            <>
              <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
                <Avatar
                  size="sm"
                  src={otherParticipant(activeConversation)?.avatarUrl}
                  initials={(otherParticipant(activeConversation)?.name || "DM").slice(0, 2).toUpperCase()}
                />
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                    {otherParticipant(activeConversation)?.name || "Conversation"}
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    One-on-one private DM
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-neutral-50 p-4 dark:bg-neutral-950">
                {loadingMessages ? (
                  <div className="text-sm text-neutral-500">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-sm text-neutral-500">
                    Start the conversation with a private message.
                  </div>
                ) : (
                  messages.map((message) => {
                    const messageId = getId(message);
                    const isMine = message.sender?._id === user?._id;
                    const parent = getParentMessage(message.parentMessageId);
                    return (
                      <div key={messageId} className={`flex gap-3 ${isMine ? "flex-row-reverse" : ""}`}>
                        <Avatar
                          size="sm"
                          src={message.sender?.avatarUrl}
                          initials={senderInitials(message.sender)}
                        />
                        <div className={`flex max-w-[75%] flex-col gap-1 ${isMine ? "items-end" : ""}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                              {senderName(message.sender)}
                            </span>
                            <span className="text-xs text-neutral-400">
                              {new Date(message.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="group relative">
                            <div
                              className={`rounded-xl px-4 py-2.5 text-sm ${
                                isMine
                                  ? "bg-primary-600 text-white"
                                  : "border border-neutral-200 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                              }`}
                            >
                              {message.parentMessageId && (
                                <div className="mb-2 rounded-lg border-l-4 border-primary-500 bg-neutral-100 px-3 py-2 dark:bg-neutral-900/60">
                                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary-500">
                                    Replying to
                                  </p>
                                  <p className="line-clamp-2 text-xs text-neutral-600 dark:text-neutral-400">
                                    {parent?.body ?? "Original message"}
                                  </p>
                                </div>
                              )}
                              <p className="whitespace-pre-wrap break-words">{message.body}</p>
                            </div>

                            <div className="absolute -top-3 right-2 hidden items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1 shadow-md group-hover:flex dark:border-neutral-700 dark:bg-neutral-900">
                              <button
                                type="button"
                                onClick={() => startReply(message)}
                                className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-primary-500 hover:underline"
                              >
                                <Reply className="h-3 w-3" />
                                Reply
                              </button>
                              {isMine && (
                                <button
                                  type="button"
                                  onClick={() => deleteMessage(messageId)}
                                  disabled={deletingMessageId === messageId}
                                  className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-red-500 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  {deletingMessageId === messageId ? "Deleting..." : "Delete"}
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
                    {typingUsers.length === 1 ? "Someone is typing..." : `${typingUsers.length} people are typing...`}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={sendMessage} className="flex flex-col gap-2 border-t border-neutral-200 p-4 dark:border-neutral-700">
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
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={draft}
                    onChange={(event) => handleDraftChange(event.target.value)}
                    placeholder={replyTo ? "Write a reply..." : "Type a private message..."}
                    className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary-500 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
                    disabled={sending}
                  />
                  <Button type="submit" variant="primary" size="md" disabled={!draft.trim() || sending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-neutral-500">
              Select a conversation or start one from an expert profile.
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
