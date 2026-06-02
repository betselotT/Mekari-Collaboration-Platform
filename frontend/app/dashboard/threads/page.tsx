"use client";

import { ChangeEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "../../../components/layout";
import { ThreadCard } from "../../../components/features/ThreadCard";
import { ThreadRepositorySearch } from "../../../components/features/ThreadRepositorySearch";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Code2, FileText, Image as ImageIcon, Paperclip, Plus, Users, X } from "lucide-react";
import { apiClient } from "../../../lib/api";
import { useLanguage } from "../../../lib/i18n";

export default function ThreadsPage() {
  return (
    <Suspense fallback={null}>
      <ThreadsContent />
    </Suspense>
  );
}

function ThreadsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const selectedSubject = searchParams?.get("subject") || "";
  const selectedSubjectSlug = searchParams?.get("subjectSlug") || "";
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedThreadStatus, setSelectedThreadStatus] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestMatch, setLatestMatch] = useState<any | null>(null);
  const [searchActive, setSearchActive] = useState(false);

  const [showNewThread, setShowNewThread] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [manualTags, setManualTags] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [showCodeSnippet, setShowCodeSnippet] = useState(false);
  const [codeSnippet, setCodeSnippet] = useState("");
  const [attachment, setAttachment] = useState<{
    type: "IMAGE" | "FILE";
    name: string;
    dataUrl: string;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Open new-thread modal pre-filled when navigating via DM from experts page
  useEffect(() => {
    const expertName = searchParams?.get("expert");
    if (expertName) {
      setInitialMessage(t("threads.prefillExpert", { name: expertName }));
      setShowNewThread(true);
    }
  }, [searchParams, t]);

  useEffect(() => {
    if (selectedSubject && !subject.trim()) {
      setSubject(selectedSubject);
    }
  }, [selectedSubject, subject]);

  const canCreate = useMemo(
    () => title.trim().length >= 5 && subject.trim().length >= 1 && initialMessage.trim().length >= 1,
    [title, subject, initialMessage]
  );
  const statusChoices = [
    { value: "all", label: t("threads.all") },
    { value: "OPEN", label: t("threads.open") },
    { value: "PENDING_EXPERT", label: t("threads.needsExpert") },
    { value: "SOLVED", label: t("threads.solved") },
  ];
  const visibleThreads = useMemo(
    () =>
      threads.filter((thread) => {
        const statusMatches =
          selectedThreadStatus === "all" || thread.status === selectedThreadStatus;
        return statusMatches;
      }),
    [threads, selectedThreadStatus]
  );

  async function loadThreads() {
    setLoading(true);
    setError(null);
    try {
      const subjectQuery = selectedSubjectSlug
        ? `?subjectSlug=${encodeURIComponent(selectedSubjectSlug)}`
        : selectedSubject
          ? `?subject=${encodeURIComponent(selectedSubject)}`
          : "";
      const res = await apiClient.get(`/api/threads${subjectQuery}`);
      setThreads(res.data.threads || []);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || t("threads.loadError"));
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
      const res = await apiClient.post("/api/threads", {
        title,
        subject,
        initialMessage: initialMessage.trim(),
        codeSnippet: codeSnippet.trim() || undefined,
        attachmentType: attachment?.type,
        attachmentName: attachment?.name,
        attachmentUrl: attachment?.dataUrl,
        tags,
      });
      const createdThread = res.data.thread;
      const createdThreadId = createdThread?._id || createdThread?.id;
      if (!createdThreadId) {
        throw new Error(t("threads.missingCreatedId"));
      }
      setLatestMatch({
        thread: createdThread,
        suggestedExperts: res.data.suggestedExperts || [],
      });

      setShowNewThread(false);
      setTitle("");
      setSubject("");
      setManualTags("");
      setInitialMessage("");
      setShowCodeSnippet(false);
      setCodeSnippet("");
      resetAttachment();
      await loadThreads();
      router.push(`/dashboard/threads/${createdThreadId}`);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || t("threads.createError"));
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
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
      setError(t("Attachments must be 4MB or smaller."));
      event.target.value = "";
      return;
    }

    if (kind === "IMAGE" && !file.type.startsWith("image/")) {
      setError(t("Choose an image file for image messages."));
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
      setError(null);
    };
    reader.onerror = () => setError(t("Could not read the selected attachment."));
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject, selectedSubjectSlug]);

  return (
    <DashboardLayout title={t("threads.title")} searchPlaceholder={t("threads.searchPlaceholder")}>
      <ThreadRepositorySearch onSearchStateChange={setSearchActive} />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!searchActive && threads.length > 0 && (
          <div className="min-w-0 overflow-x-auto pb-1 sm:pb-0">
            <div className="flex min-w-max gap-2">
              {statusChoices.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  onClick={() =>
                    setSelectedThreadStatus((current) =>
                      current === choice.value ? "all" : choice.value
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedThreadStatus === choice.value
                      ? "border-purple-600 bg-purple-600 text-white"
                      : "border-neutral-300 bg-white text-neutral-700 hover:border-purple-300 hover:text-purple-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-purple-700 dark:hover:text-purple-200"
                  }`}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <Button variant="primary" size="md" className="w-full sm:w-auto" onClick={() => setShowNewThread(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("threads.newThread")}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      {latestMatch && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <Users className="h-5 w-5 text-amber-700 dark:text-amber-300" />
              <div>
                <h3 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                  {t("threads.suggestedMentors")}
                </h3>
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  {t("threads.suggestedMentorsHelp")}
                </p>
              </div>
            </div>
            <a
              href={`/dashboard/threads/${latestMatch.thread?._id || latestMatch.thread?.id}`}
              className="inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              {t("threads.openThread")}
            </a>
          </div>

          {latestMatch.suggestedExperts.length === 0 ? (
            <p className="text-sm text-amber-900 dark:text-amber-100">
              {t("threads.noStrongMatch")}
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {latestMatch.suggestedExperts.map((rec: any) => {
                const expert = rec.expert;
                const expertise = expert.expertise?.[0]?.subject || expert.skillTags?.[0] || t("role.mentor");
                return (
                  <div
                    key={expert._id}
                    className="rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-900/40 dark:bg-neutral-900"
                  >
                    <div className="text-sm font-bold text-neutral-900 dark:text-white">
                      {expert.name}
                    </div>
                    <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                      {expertise} - {expert.availabilityStatus}
                    </div>
                    <div className="mt-2 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                      {t("threads.matchScore")} {Math.round(rec.score)}
                    </div>
                    <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                      {rec.reasons?.[0] || t("threads.relevantMentor")}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* New thread modal */}
      {showNewThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-3 py-6 sm:px-4">
          <div className="max-h-[calc(100dvh-3rem)] w-full max-w-xl overflow-y-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{t("threads.createTitle")}</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {t("threads.createHelp")}
                </p>
              </div>
              <button
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                onClick={() => setShowNewThread(false)}
              >
                {t("threads.close")}
              </button>
            </div>

            <div className="space-y-4">
              <Input label={t("threads.fieldTitle")} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("threads.titlePlaceholder")} />
              <Input label={t("threads.subject")} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("threads.subjectPlaceholder")} />
              <Input
                label={t("threads.tags")}
                value={manualTags}
                onChange={(e) => setManualTags(e.target.value)}
                placeholder={t("threads.tagsPlaceholder")}
              />
              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {t("threads.initialMessage")}
                </label>
                <div className="rounded-xl border border-neutral-200 bg-white p-2 dark:border-neutral-700 dark:bg-neutral-950">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCodeSnippet((value) => !value)}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors sm:px-3 ${
                        showCodeSnippet
                          ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950"
                          : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      }`}
                      title={t("Add code snippet")}
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

                  {showCodeSnippet && (
                    <textarea
                      rows={5}
                      className="mb-2 w-full resize-none rounded-lg border border-neutral-300 bg-neutral-950 px-3 py-2 font-mono text-xs leading-5 text-neutral-100 outline-none transition-colors focus:border-primary-500 dark:border-neutral-600"
                      value={codeSnippet}
                      onChange={(e) => setCodeSnippet(e.target.value)}
                      placeholder={t("Paste a code snippet...")}
                    />
                  )}

                  <textarea
                    rows={4}
                    className="min-h-[120px] w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-primary-500 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                    placeholder={t("threads.initialPlaceholder")}
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Button variant="secondary" size="md" onClick={() => setShowNewThread(false)}>
                  {t("threads.cancel")}
                </Button>
                <Button variant="primary" size="md" disabled={!canCreate || creating} onClick={() => void createThread()}>
                  {creating ? t("threads.creating") : t("threads.createThread")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Thread list */}
      {!searchActive && <div className="space-y-4">
        {loading ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
            {t("threads.loading")}
          </div>
        ) : threads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
            {t("threads.empty")}
          </div>
        ) : visibleThreads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
            {t("threads.noFilterMatch")}
          </div>
        ) : (
          visibleThreads.map((thread) => (
            <ThreadCard
              key={thread._id || thread.id}
              title={thread.title}
              category={String(thread.subject || t("threads.defaultCategory")).toUpperCase()}
              description={thread.preview || t("threads.defaultDescription")}
              author={thread.createdBy?.name || t("threads.unknownAuthor")}
              timestamp={new Date(thread.updatedAt || thread.createdAt || Date.now()).toLocaleString()}
              replyCount={Math.max(0, (thread.messageCount || 1) - 1)}
              tags={thread.tags || []}
              status={thread.status}
              href={`/dashboard/threads/${thread._id || thread.id}`}
            />
          ))
        )}
      </div>}
    </DashboardLayout>
  );
}
