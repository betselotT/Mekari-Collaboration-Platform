// Defines the expected structure of the match request API response.
// Includes generated discussion thread information,
// request metadata, and ranked expert recommendations
// returned from the matching engine.
"use client";

import { Suspense, useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { apiClient } from "../../../lib/api";
import { useLanguage } from "../../../lib/i18n";

const SUBJECT_OPTIONS = [
  "Software Engineering",
  "Databases",
  "Frontend Development",
  "Backend Development",
  "DevOps",
  "Artificial Intelligence",
  "Data Structures and Algorithms",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Electromechanical Engineering",
];

type MatchRequestResponse = {
  thread: { _id?: string; id?: string; title: string; subject: string };
  matchRequest: {
    _id: string;
    subject: string;
    tags: string[];
    availabilityPreference: string;
    status: string;
    recommendations: Array<{
      expert: {
        _id: string;
        name: string;
        avatarUrl?: string;
        availabilityStatus: "online" | "busy" | "offline";
        points: number;
        expertise: Array<{ subject: string; proficiency: string }>;
        badges: string[];
      };
      score: number;
      reasons: string[];
    }>;
  };
};
// Wrapper page component for the expert matching feature.
// Suspense is used here to support async search param handling
// and avoid rendering issues during client-side navigation.
export default function MatchPage() {
  return (
    <Suspense fallback={null}>
      <MatchContent />
    </Suspense>
  );
}

function MatchContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [tags, setTags] = useState("");

  // Pre-populates matching fields using URL query parameters.
// This supports smoother navigation flows when users
// initiate matching from related pages such as
// expert discovery or recommendation views.
  useEffect(() => {
    const s = searchParams?.get("subject");
    const t = searchParams?.get("tags");
    if (s) setSubject(s);
    if (t) setTags(t);
  }, [searchParams]);
  const [initialMessage, setInitialMessage] = useState("");
  const [availabilityPreference, setAvailabilityPreference] = useState<
    "online_only" | "online_or_busy" | "any"
  >("online_or_busy");

  const [loading, setLoading] = useState(false);
  const [dmLoadingId, setDmLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchRequestResponse | null>(null);

  const parsedTags = useMemo(
    () =>
      tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [tags]
  );

// Submits the expert matching request to the backend service.
// Handles loading state, error management,
// and stores recommendation results for display
// after successful response processing.
  async function submit() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiClient.post<MatchRequestResponse>("/api/matching/request", {
        title,
        subject,
        initialMessage,
        tags: parsedTags,
        availabilityPreference,
      });
      setResult(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || t("Failed to create match request"));
    } finally {
      setLoading(false);
    }
  }

  async function openDm(expertId: string) {
    if (dmLoadingId) return;
    setDmLoadingId(expertId);
    setError(null);
    try {
      const res = await apiClient.post<{ conversation: { _id: string } }>(
        "/api/dms/conversations",
        { expertId }
      );
      router.push(`/dashboard/messages?conversation=${res.data.conversation._id}`);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || t("Failed to start direct message"));
    } finally {
      setDmLoadingId(null);
    }
  }

  return (
    <DashboardLayout title={t("Match with an Expert")} searchPlaceholder={t("Search experts, topics...")}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
          <h2 className="mb-1 text-lg font-bold text-neutral-900 dark:text-white">
            {t("Tell us what you need help with")}
          </h2>
          <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
            We’ll compute a weighted match using topic tags, reputation, and availability.
          </p>

          <div className="space-y-4">
            <Input
              label={t("Thread title")}
              placeholder={t("e.g., Designing MongoDB indexes for analytics")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <Input
              label={t("Primary subject")}
              placeholder={t("e.g., Databases")}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              list="match-subject-options"
            />
            <datalist id="match-subject-options">
              {SUBJECT_OPTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>

            <Input
              label={t("Topic tags (comma-separated)")}
              placeholder={t("e.g., MongoDB, Indexing, Query Optimization")}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {t("Problem description")}
              </label>
              <textarea
                className="min-h-[120px] w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-primary-500 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
              placeholder={t("Add context, constraints, code snippet links, and what you’ve tried...")}
              />
            </div>

            <div>
              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {t("Availability preference")}
                </label>
                <select
                  value={availabilityPreference}
                  onChange={(e) =>
                    setAvailabilityPreference(e.target.value as any)
                  }
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-primary-500 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  <option value="online_only">{t("Online only")}</option>
                  <option value="online_or_busy">{t("Online or busy")}</option>
                  <option value="any">{t("Any (including offline)")}</option>
                </select>
              </div>

            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
                {error}
              </div>
            )}

            <Button
              variant="primary"
              size="md"
              onClick={submit}
              disabled={loading || !title || !subject || !initialMessage}
            >
              {loading ? t("Matching...") : t("Find experts")}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
          <h2 className="mb-1 text-lg font-bold text-neutral-900 dark:text-white">
            {t("Recommendations")}
          </h2>
          <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
            Results are ranked by weighted score (tag match, proficiency, reputation, availability).
          </p>

          {!result ? (
            <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
              {t("Submit a match request to see recommended experts here.")}
            </div>
          ) : result.matchRequest.recommendations.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              {t("No available experts matched your tags yet. Try broader tags or allow busy experts.")}
            </div>
          ) : (
            <div className="space-y-4">
              {result.matchRequest.recommendations.map((rec) => (
                <div
                  role="button"
                  tabIndex={0}
                  key={rec.expert._id}
                  onClick={() => openDm(rec.expert._id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openDm(rec.expert._id);
                    }
                  }}
                  aria-disabled={dmLoadingId !== null}
                  className={`w-full cursor-pointer rounded-lg border border-neutral-200 bg-white p-4 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/40 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/20 ${
                    dmLoadingId !== null ? "cursor-wait opacity-70" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-neutral-900 underline-offset-4 hover:underline dark:text-white">
                          {rec.expert.name}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700 dark:border-primary-900/50 dark:bg-primary-950/30 dark:text-primary-200">
                          <MessageSquare className="h-3 w-3" />
                          {dmLoadingId === rec.expert._id ? t("Opening...") : "DM"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                        Availability: {rec.expert.availabilityStatus} • Points: {rec.expert.points}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {rec.expert.expertise.slice(0, 4).map((e) => (
                          <span
                            key={`${rec.expert._id}-${e.subject}`}
                            className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                          >
                            {e.subject} ({e.proficiency})
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 rounded-full bg-primary-600 px-3 py-1 text-xs font-bold text-white">
                      {rec.score}
                    </div>
                  </div>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-neutral-600 dark:text-neutral-400">
                    {rec.reasons.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

