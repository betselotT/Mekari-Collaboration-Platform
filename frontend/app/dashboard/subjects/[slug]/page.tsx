"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpen, MessageSquare, Plus, Users } from "lucide-react";
import { DashboardLayout } from "../../../../components/layout";
import { StatCard } from "../../../../components/features/StatCard";
import { ThreadCard } from "../../../../components/features/ThreadCard";
import { Button } from "../../../../components/ui/Button";
import { apiClient } from "../../../../lib/api";

type SubjectSummary = {
  subject: string;
  slug: string;
  activeThreads: number;
  weeklyThreads: number;
  weeklyChange: number;
  expertsOnline: number;
  resources: number;
};

type ThreadAuthor = {
  name?: string;
  avatarUrl?: string;
};

type Thread = {
  _id?: string;
  id?: string;
  title: string;
  subject: string;
  tags?: string[];
  status?: string;
  createdBy?: ThreadAuthor;
  createdAt?: string;
  updatedAt?: string;
  messageCount?: number;
  preview?: string;
};

function formatDate(value?: string) {
  if (!value) return "Recently updated";
  return new Date(value).toLocaleString();
}

export default function SubjectPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || "";
  const [summary, setSummary] = useState<SubjectSummary | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    let mounted = true;
    setLoading(true);
    setError(null);
    setSummary(null);
    setThreads([]);

    apiClient
      .get<{ subject: SubjectSummary }>(`/api/threads/subjects/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (!mounted) return;
        const subjectSummary = res.data.subject;
        setSummary(subjectSummary);
        const threadsRes = await apiClient.get<{ threads: Thread[] }>(
          `/api/threads?subjectSlug=${encodeURIComponent(subjectSummary.slug)}`
        );
        if (!mounted) return;
        setThreads(threadsRes.data.threads || []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.response?.data?.error?.message || "Failed to load subject");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [slug]);

  const title = summary?.subject || "Subject";
  const recentThreads = useMemo(() => threads.slice(0, 10), [threads]);

  return (
    <DashboardLayout title={title} searchPlaceholder="Search threads, experts...">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="mb-2 text-3xl font-bold text-neutral-900 dark:text-white">{title}</h2>
          <p className="text-neutral-600 dark:text-neutral-400">
            Browse active discussions, mentors, and files shared in this subject.
          </p>
        </div>
        {summary && (
          <Link
            href={`/dashboard/threads?subjectSlug=${encodeURIComponent(summary.slug)}&subject=${encodeURIComponent(summary.subject)}`}
          >
            <Button variant="primary" size="md">
              <Plus className="h-4 w-4" />
              Open Thread Board
            </Button>
          </Link>
        )}
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <StatCard
          icon={MessageSquare}
          label="Active Threads"
          value={loading ? "..." : summary?.activeThreads ?? 0}
          change={summary?.weeklyChange ?? 0}
          description={`${summary?.weeklyThreads ?? 0} new this week`}
        />
        <StatCard
          icon={Users}
          label="Experts Online"
          value={loading ? "..." : summary?.expertsOnline ?? 0}
          description="Currently providing guidance"
        />
        <StatCard
          icon={BookOpen}
          label="Resources"
          value={loading ? "..." : summary?.resources ?? 0}
          description="Files shared in threads"
        />
      </div>

      <div className="mb-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Available Threads</h3>
          {summary && (
            <Link
              href={`/dashboard/threads?subjectSlug=${encodeURIComponent(summary.slug)}&subject=${encodeURIComponent(summary.subject)}`}
              className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400"
            >
              View All
            </Link>
          )}
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
              Loading subject threads...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </div>
          ) : recentThreads.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
              No threads are available for this subject yet.
            </div>
          ) : (
            recentThreads.map((thread) => (
              <ThreadCard
                key={thread._id || thread.id}
                title={thread.title}
                category={String(thread.subject || "General").toUpperCase()}
                description={thread.preview || "Open the thread to view details."}
                author={thread.createdBy?.name || "Unknown"}
                timestamp={formatDate(thread.updatedAt || thread.createdAt)}
                replyCount={Math.max(0, (thread.messageCount || 1) - 1)}
                tags={thread.tags || []}
                status={thread.status}
                href={`/dashboard/threads/${thread._id || thread.id}`}
              />
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
