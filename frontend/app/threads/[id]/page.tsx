"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowUp, LogIn, MessageCircle, Reply } from "lucide-react";
import { apiClient } from "../../../lib/api";
import { ThemeToggle } from "../../../components/theme/ThemeToggle";
import { LanguageToggle } from "../../../components/i18n/LanguageToggle";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Avatar } from "../../../components/ui/Avatar";
import { useLanguage } from "../../../lib/i18n";

interface Sender {
  _id: string;
  name: string;
  avatarUrl?: string;
}

interface PublicThread {
  _id: string;
  title: string;
  subject: string;
  body?: string;
  tags?: string[];
  status: string;
  repliesCount?: number;
  upvoteCount?: number;
  createdAt: string;
  createdBy?: Sender;
}

interface PublicMessage {
  _id: string;
  sender: Sender | string;
  body: string;
  type: string;
  isFromAi: boolean;
  createdAt: string;
  upvotes?: string[];
  parentMessageId?: string;
}

function senderName(sender: Sender | string, fallback: string): string {
  return typeof sender === "string" ? fallback : sender.name || fallback;
}

function messageId(message: PublicMessage): string {
  return message._id;
}

export default function PublicThreadDetailPage() {
  const { t } = useLanguage();
  const params = useParams<{ id: string }>();
  const threadId = params?.id || "";
  const [thread, setThread] = useState<PublicThread | null>(null);
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messageById = new Map(messages.map((message) => [messageId(message), message]));

  useEffect(() => {
    if (!threadId) return;

    let mounted = true;

    async function loadPublicThread() {
      setLoading(true);
      setError(null);

      try {
        const threadRes = await apiClient.get<{ thread: PublicThread }>(
          `/api/threads/public/${threadId}`
        );
        if (!mounted) return;

        setThread(threadRes.data.thread);

        try {
          const messagesRes = await apiClient.get<{ messages: PublicMessage[] }>(
            `/api/threads/public/${threadId}/messages`
          );
          if (mounted) setMessages(messagesRes.data.messages || []);
        } catch (messageErr: any) {
          if (mounted) {
            setMessages([]);
            setError(
              messageErr?.response?.data?.error?.message ||
                t("Thread loaded, but replies could not be loaded.")
            );
          }
        }
      } catch (err: any) {
        if (!mounted) return;
        setThread(null);
        setMessages([]);
        setError(
          err?.response?.status === 404
            ? t("Thread not found.")
            : err?.response?.data?.error?.message || t("Failed to load this thread.")
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPublicThread();

    return () => {
      mounted = false;
    };
  }, [threadId]);

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/threads" className="inline-flex items-center gap-2 text-sm font-medium">
            <ArrowLeft className="h-4 w-4" />
            {t("Public threads")}
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LanguageToggle />
            <Link href="/login">
              <Button variant="outline" size="sm">
                <LogIn className="mr-2 h-4 w-4" />
                {t("Sign in to join")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-8">
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            {t("Loading thread...")}
          </div>
        ) : !thread ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            {error || t("This thread could not be loaded.")}
          </div>
        ) : (
          <div className="space-y-4">
            <article className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="info">{thread.subject}</Badge>
                <Badge variant="default">{t(thread.status)}</Badge>
                {(thread.tags || []).map((tag) => (
                  <Badge key={tag} variant="default">
                    {tag}
                  </Badge>
                ))}
              </div>
              <h1 className="text-2xl font-bold">{thread.title}</h1>
              {thread.body && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">
                  {thread.body}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                <span>{t("By")} {thread.createdBy?.name || t("threads.unknownAuthor")}</span>
                <span>{new Date(thread.createdAt).toLocaleString()}</span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {thread.repliesCount || 0} {t("threads.replyLabel")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ArrowUp className="h-3.5 w-3.5" />
                  {thread.upvoteCount || 0} {t("upvotes")}
                </span>
              </div>
              <div className="mt-5">
                <Link href="/login">
                  <Button variant="primary" size="sm">{t("Join discussion")}</Button>
                </Link>
              </div>
            </article>

            <section className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MessageCircle className="h-4 w-4 text-primary-500" />
                  {t("Replies")}
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {messages.length} {t("messages")}
                </span>
              </div>

              <div className="space-y-0">
                {messages.length === 0 ? (
                  <div className="p-5 text-sm text-neutral-600 dark:text-neutral-400">
                    {t("No replies yet.")}
                  </div>
                ) : (
                  messages.map((message) => {
                    const parent = message.parentMessageId
                      ? messageById.get(String(message.parentMessageId))
                      : null;

                    return (
                      <article
                        key={message._id}
                        className="border-b border-neutral-100 p-4 last:border-b-0 dark:border-neutral-800"
                      >
                        <div className="mb-3 flex items-center gap-2">
                          <Avatar
                            size="sm"
                            initials={senderName(message.sender, t("user")).slice(0, 2).toUpperCase()}
                            src={typeof message.sender === "object" ? message.sender.avatarUrl : undefined}
                          />
                          <div>
                            <p className="text-sm font-medium">
                              {message.isFromAi ? "Mekari AI" : senderName(message.sender, t("user"))}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {new Date(message.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {message.parentMessageId && (
                          <div className="mb-3 rounded-lg border border-primary-100 bg-primary-50/70 px-3 py-2 dark:border-primary-900/40 dark:bg-primary-950/20">
                            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary-700 dark:text-primary-300">
                              <Reply className="h-3.5 w-3.5" />
                              {t("Replying to")} {parent ? senderName(parent.sender, t("user")) : t("another message")}
                            </div>
                            <p className="line-clamp-2 text-xs text-neutral-600 dark:text-neutral-400">
                              {parent?.body || t("Original message is not available in this view.")}
                            </p>
                          </div>
                        )}

                        <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                          {message.body}
                        </p>
                        <div className="mt-3 inline-flex items-center gap-1 text-xs text-neutral-500">
                          <ArrowUp className="h-3.5 w-3.5" />
                          {message.upvotes?.length || 0} {t("upvotes")}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
