"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpen, ExternalLink, FileText, MessageSquare, Plus, Users } from "lucide-react";
import { DashboardLayout } from "../../../../components/layout";
import { StatCard } from "../../../../components/features/StatCard";
import { ThreadCard } from "../../../../components/features/ThreadCard";
import { Button } from "../../../../components/ui/Button";
import { Avatar } from "../../../../components/ui/Avatar";
import { Badge } from "../../../../components/ui/Badge";
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

type Expert = {
  _id?: string;
  id?: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  expertise?: Array<{ subject: string; proficiency: string }>;
  skillTags?: string[];
  availabilityStatus?: string;
  points?: number;
};

type Resource = {
  _id?: string;
  id?: string;
  body: string;
  attachmentUrl?: string;
  createdAt?: string;
  sender?: ThreadAuthor;
  thread?: {
    _id?: string;
    id?: string;
    title?: string;
    subject?: string;
  };
};

type ActivePanel = "threads" | "experts" | "resources";

function formatDate(value?: string) {
  if (!value) return "Recently updated";
  return new Date(value).toLocaleString();
}

function initials(name?: string) {
  return (name || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
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

export default function SubjectPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || "";
  const [summary, setSummary] = useState<SubjectSummary | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [activePanel, setActivePanel] = useState<ActivePanel>("threads");
  const [loading, setLoading] = useState(true);
  const [loadingPanel, setLoadingPanel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    let mounted = true;
    setLoading(true);
    setError(null);
    setSummary(null);
    setThreads([]);
    setExperts([]);
    setResources([]);
    setActivePanel("threads");

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
  const threadBoardHref = summary
    ? `/dashboard/threads?subjectSlug=${encodeURIComponent(summary.slug)}&subject=${encodeURIComponent(summary.subject)}`
    : "/dashboard/threads";

  async function showExperts() {
    if (!summary) return;
    setActivePanel("experts");
    if (experts.length > 0) return;
    setLoadingPanel(true);
    try {
      const res = await apiClient.get<{ experts: Expert[] }>(
        `/api/threads/subjects/${encodeURIComponent(summary.slug)}/experts`
      );
      setExperts(res.data.experts || []);
    } finally {
      setLoadingPanel(false);
    }
  }

  async function showResources() {
    if (!summary) return;
    setActivePanel("resources");
    if (resources.length > 0) return;
    setLoadingPanel(true);
    try {
      const res = await apiClient.get<{ resources: Resource[] }>(
        `/api/threads/subjects/${encodeURIComponent(summary.slug)}/resources`
      );
      setResources(res.data.resources || []);
    } finally {
      setLoadingPanel(false);
    }
  }

  function openResource(resource: Resource) {
    if (!resource.attachmentUrl) return;

    const link = document.createElement("a");
    link.download = resource.body || "shared-file";

    if (resource.attachmentUrl.startsWith("data:")) {
      const blob = dataUrlToBlob(resource.attachmentUrl);
      if (!blob) return;
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      return;
    }

    link.href = resource.attachmentUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

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
          <Link href={threadBoardHref}>
            <Button variant="primary" size="md">
              <Plus className="h-4 w-4" />
              Open Thread Board
            </Button>
          </Link>
        )}
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Link href={threadBoardHref} className="block transition-transform hover:-translate-y-0.5">
          <StatCard
            icon={MessageSquare}
            label="Active Threads"
            value={loading ? "..." : summary?.activeThreads ?? 0}
            change={summary?.weeklyChange ?? 0}
            description={`${summary?.weeklyThreads ?? 0} new this week`}
          />
        </Link>
        <button type="button" onClick={showExperts} className="block text-left transition-transform hover:-translate-y-0.5">
          <StatCard
            icon={Users}
            label="Experts Online"
            value={loading ? "..." : summary?.expertsOnline ?? 0}
            description="Currently providing guidance"
          />
        </button>
        <button type="button" onClick={showResources} className="block text-left transition-transform hover:-translate-y-0.5">
          <StatCard
            icon={BookOpen}
            label="Resources"
            value={loading ? "..." : summary?.resources ?? 0}
            description="Files shared in threads"
          />
        </button>
      </div>

      <div className="mb-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
            {activePanel === "experts"
              ? "Online Experts"
              : activePanel === "resources"
                ? "Shared Files"
                : "Available Threads"}
          </h3>
          {summary && (
            <Link
              href={threadBoardHref}
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
          ) : activePanel === "experts" ? (
            loadingPanel ? (
              <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
                Loading online experts...
              </div>
            ) : experts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
                No online experts are available for this subject right now.
              </div>
            ) : (
              experts.map((expert) => (
                <Link
                  key={expert._id || expert.id}
                  href={`/dashboard/profile/${expert._id || expert.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4 text-left transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={expert.avatarUrl} initials={initials(expert.name)} status="online" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-neutral-900 dark:text-white">{expert.name}</p>
                      <p className="line-clamp-1 text-sm text-neutral-600 dark:text-neutral-400">
                        {expert.bio || expert.expertise?.[0]?.subject || "Available to help"}
                      </p>
                    </div>
                  </div>
                  <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    {(expert.expertise || []).slice(0, 2).map((item) => (
                      <Badge key={`${expert._id}-${item.subject}`} variant="primary">
                        {item.subject}
                      </Badge>
                    ))}
                  </div>
                </Link>
              ))
            )
          ) : activePanel === "resources" ? (
            loadingPanel ? (
              <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
                Loading shared files...
              </div>
            ) : resources.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
                No files have been shared in this subject yet.
              </div>
            ) : (
              resources.map((resource) => (
                <button
                  type="button"
                  key={resource._id || resource.id}
                  onClick={() => openResource(resource)}
                  disabled={!resource.attachmentUrl}
                  className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-neutral-900 dark:text-white">{resource.body || "Shared file"}</p>
                      <p className="truncate text-sm text-neutral-600 dark:text-neutral-400">
                        {resource.thread?.title || "Thread"} · {resource.sender?.name || "Unknown"} · {formatDate(resource.createdAt)}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 shrink-0 text-neutral-500" />
                </button>
              ))
            )
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
