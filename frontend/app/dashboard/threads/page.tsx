"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "../../../components/layout";
import { ThreadCard } from "../../../components/features/ThreadCard";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { MessageCircle, Plus } from "lucide-react";
import { apiClient } from "../../../lib/api";

export default function ThreadsPage() {
  return (
    <Suspense fallback={null}>
      <ThreadsContent />
    </Suspense>
  );
}

function ThreadsContent() {
  const searchParams = useSearchParams();
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showNewThread, setShowNewThread] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [manualTags, setManualTags] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);

  // Open new-thread modal pre-filled when navigating via DM from experts page
  useEffect(() => {
    const expertName = searchParams?.get("expert");
    if (expertName) {
      setInitialMessage(`Hi ${expertName}, I'd like to get your help with...`);
      setShowNewThread(true);
    }
  }, [searchParams]);

  const canCreate = useMemo(
    () => title.trim().length >= 5 && subject.trim().length >= 1 && initialMessage.trim().length >= 1,
    [title, subject, initialMessage]
  );

  async function loadThreads() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/api/threads");
      setThreads(res.data.threads || []);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || "Failed to load threads");
    } finally {
      setLoading(false);
    }
  }

  async function createThread() {
    if (!canCreate || creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setError(null);
    try {
      const tags = manualTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      await apiClient.post("/api/threads", { title, subject, initialMessage, tags });
      setShowNewThread(false);
      setTitle("");
      setSubject("");
      setManualTags("");
      setInitialMessage("");
      await loadThreads();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || "Failed to create thread");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  useEffect(() => {
    loadThreads();
  }, []);

  return (
    <DashboardLayout title="Threads" searchPlaceholder="Search threads, experts...">
      {/* Header with filters */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary-600" />
          <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
            THREADS
          </span>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowNewThread(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Thread
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* New thread modal */}
      {showNewThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Create a new thread</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Add your own tags. Gemini will add extra topic tags from the content.
                </p>
              </div>
              <button
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                onClick={() => setShowNewThread(false)}
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Min 5 characters" />
              <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g., Software Engineering" />
              <Input
                label="Your tags"
                value={manualTags}
                onChange={(e) => setManualTags(e.target.value)}
                placeholder="e.g., mongodb, indexing, performance"
              />
              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Initial message
                </label>
                <textarea
                  className="min-h-[120px] w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-primary-500 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  placeholder="Describe the problem, what you've tried, constraints, and expected outcome..."
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="secondary" size="md" onClick={() => setShowNewThread(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="md" disabled={!canCreate || creating} onClick={() => void createThread()}>
                  {creating ? "Creating..." : "Create thread"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Thread list */}
      <div className="space-y-4">
        {loading ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
            Loading threads...
          </div>
        ) : threads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
            No threads yet. Create one to get started.
          </div>
        ) : (
          threads.map((t) => (
            <ThreadCard
              key={t._id || t.id}
              title={t.title}
              category={String(t.subject || "General").toUpperCase()}
              description={t.preview || "Open the thread to view details."}
              author={t.createdBy?.name || "Unknown"}
              timestamp={new Date(t.updatedAt || t.createdAt || Date.now()).toLocaleString()}
              replyCount={Math.max(0, (t.messageCount || 1) - 1)}
              tags={t.tags || []}
              status={t.status}
              href={`/dashboard/threads/${t._id || t.id}`}
            />
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
