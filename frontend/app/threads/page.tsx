"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  ArrowRight,
  ArrowUp,
  Clock3,
  LogIn,
  MessageCircle,
  Search,
  Sparkles,
} from "lucide-react";

import { apiClient } from "../../lib/api";

import { ThemeToggle } from "../../components/theme/ThemeToggle";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

interface PublicThread {
  _id: string;
  title: string;
  subject: string;
  tags?: string[];
  status: string;
  repliesCount?: number;
  upvoteCount?: number;
  updatedAt: string;
  createdAt: string;
  createdBy?: {
    name?: string;
  };
}

const EMPTY_STATE_MESSAGE = "No public threads yet.";

const THREADS_ENDPOINT = "/api/threads/public";

export default function PublicThreadsPage() {
  const [threads, setThreads] = useState<PublicThread[]>([]);

  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ threads: PublicThread[] }>(
        THREADS_ENDPOINT
      )
      .then((res) => {
        setThreads(res.data.threads || []);
      })
      .catch((err) => {
        setError(
          err?.response?.data?.error?.message ||
            "Failed to load threads"
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredThreads = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) {
      return threads;
    }

    return threads.filter((thread) =>
      [
        thread.title,
        thread.subject,
        thread.status,
        thread.createdBy?.name,
        ...(thread.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [query, threads]);

  const totalReplies = threads.reduce(
    (sum, thread) => sum + (thread.repliesCount || 0),
    0
  );

  const totalUpvotes = threads.reduce(
    (sum, thread) => sum + (thread.upvoteCount || 0),
    0
  );

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
              M
            </div>

            <span className="text-lg font-bold">
              Mekari
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            <Link href="/login">
              <Button variant="outline" size="sm">
                <LogIn className="mr-2 h-4 w-4" />
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <Badge variant="info">
              Public threads
            </Badge>

            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Browse discussion threads
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              Explore community questions,
              answers, and solved discussions
              before joining the conversation.
            </p>

            <div className="mt-5 max-w-xl">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />

                <input
                  value={query}
                  onChange={(event) =>
                    setQuery(event.target.value)
                  }
                  placeholder="Search by title, subject, author, or tag"
                  className="w-full rounded-lg border border-neutral-300 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-900"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary-500" />

              Community discussions
            </div>

            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {filteredThreads.length} shown
            </span>
          </div>

          {loading ? (
            <div className="p-4 text-sm text-neutral-600 dark:text-neutral-400">
              Loading threads...
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-6 text-sm text-neutral-600 dark:text-neutral-400">
              {EMPTY_STATE_MESSAGE}
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <Link
                key={thread._id}
                href={`/threads/${thread._id}`}
                className="group block border-b border-neutral-100 p-4 transition last:border-b-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/60"
              >
                <div className="flex gap-4">
                  <div className="hidden w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-neutral-50 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 sm:flex">
                    <span className="text-lg font-bold text-neutral-900 dark:text-white">
                      {thread.repliesCount || 0}
                    </span>

                    replies
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="info">
                        {thread.subject || "General"}
                      </Badge>

                      <Badge variant="default">
                        {thread.status}
                      </Badge>

                      {(thread.tags || [])
                        .slice(0, 3)
                        .map((tag) => (
                          <Badge
                            key={tag}
                            variant="default"
                          >
                            {tag}
                          </Badge>
                        ))}
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-base font-bold text-neutral-950 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                        {thread.title}
                      </h2>

                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-primary-500" />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                      <span>
                        By{" "}
                        {thread.createdBy?.name ||
                          "Unknown"}
                      </span>

                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" />

                        {new Date(
                          thread.updatedAt ||
                            thread.createdAt
                        ).toLocaleString()}
                      </span>

                      <span className="inline-flex items-center gap-1 sm:hidden">
                        <MessageCircle className="h-3.5 w-3.5" />

                        {thread.repliesCount || 0} replies
                      </span>

                      <span className="inline-flex items-center gap-1">
                        <ArrowUp className="h-3.5 w-3.5" />

                        {thread.upvoteCount || 0} upvotes
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
