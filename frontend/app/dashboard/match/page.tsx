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

const TECHNICAL_FIELD_OPTIONS = [
  "Software Engineering",
  "Computer Science",
  "Information Systems",
  "Data Science",
  "Artificial Intelligence",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Electromechanical Engineering",
  "Cybersecurity",
  "DevOps",
];

const ROLE_OPTIONS = [
  "Student",
  "Junior Developer",
  "Mid-level Developer",
  "Senior Developer",
  "Researcher",
  "Instructor",
  "Engineer",
  "Hobbyist",
];

const EXPERIENCE_OPTIONS = [
  "Less than 1 year",
  "1-3 years",
  "3-5 years",
  "5-10 years",
  "10+ years",
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

  // Questionnaire subset (focused on matching)
  const [roleOrStatus, setRoleOrStatus] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [primaryTechnicalField, setPrimaryTechnicalField] = useState("");
  const [connectionPreferences, setConnectionPreferences] = useState<
    Array<"chat" | "voice_video" | "group_channel">
  >(["chat"]);

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
        questionnaire: {
          primaryTechnicalField: primaryTechnicalField || undefined,
          roleOrStatus: roleOrStatus || undefined,
          yearsOfExperience: yearsOfExperience || undefined,
          connectionPreferences,
        },
      });
      setResult(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || "Failed to create match request");
    } finally {
      setLoading(false);
    }
  }

  function toggleConnectionPreference(value: "chat" | "voice_video" | "group_channel") {
    setConnectionPreferences((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      return [...prev, value];
    });
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
      setError(e?.response?.data?.error?.message || "Failed to start direct message");
    } finally {
      setDmLoadingId(null);
    }
  }

  return (
    <DashboardLayout title="Match with an Expert" searchPlaceholder="Search experts, topics...">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
          <h2 className="mb-1 text-lg font-bold text-neutral-900 dark:text-white">
            Tell us what you need help with
          </h2>
          <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
            We’ll compute a weighted match using topic tags, reputation, and availability.
          </p>

          <div className="space-y-4">
            <Input
              label="Thread title"
              placeholder="e.g., Designing MongoDB indexes for analytics"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <Input
              label="Primary subject"
              placeholder="e.g., Databases"
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
              label="Topic tags (comma-separated)"
              placeholder="e.g., MongoDB, Indexing, Query Optimization"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Problem description
              </label>
              <textarea
                className="min-h-[120px] w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-primary-500 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                placeholder="Add context, constraints, code snippet links, and what you’ve tried..."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Your technical field"
                placeholder="e.g., Software Engineering"
                value={primaryTechnicalField}
                onChange={(e) => setPrimaryTechnicalField(e.target.value)}
                list="match-technical-field-options"
              />
              <datalist id="match-technical-field-options">
                {TECHNICAL_FIELD_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              <Input
                label="Role/status"
                placeholder="e.g., Student"
                value={roleOrStatus}
                onChange={(e) => setRoleOrStatus(e.target.value)}
                list="match-role-options"
              />
              <datalist id="match-role-options">
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            <Input
              label="Years of experience"
              placeholder="e.g., 1–3 years"
              value={yearsOfExperience}
              onChange={(e) => setYearsOfExperience(e.target.value)}
              list="match-experience-options"
            />
            <datalist id="match-experience-options">
              {EXPERIENCE_OPTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Availability preference
                </label>
                <select
                  value={availabilityPreference}
                  onChange={(e) =>
                    setAvailabilityPreference(e.target.value as any)
                  }
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-primary-500 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  <option value="online_only">Online only</option>
                  <option value="online_or_busy">Online or busy</option>
                  <option value="any">Any (including offline)</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Preferred connection
                </label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: "chat", label: "Chat" },
                      { id: "voice_video", label: "Voice/Video" },
                      { id: "group_channel", label: "Group channel" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleConnectionPreference(opt.id)}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                        connectionPreferences.includes(opt.id)
                          ? "border-primary-600 bg-primary-600 text-white"
                          : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
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
              {loading ? "Matching..." : "Find experts"}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
          <h2 className="mb-1 text-lg font-bold text-neutral-900 dark:text-white">
            Recommendations
          </h2>
          <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
            Results are ranked by weighted score (tag match, proficiency, reputation, availability).
          </p>

          {!result ? (
            <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
              Submit a match request to see recommended experts here.
            </div>
          ) : result.matchRequest.recommendations.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              No available experts matched your tags yet. Try broader tags or allow busy experts.
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
                          {dmLoadingId === rec.expert._id ? "Opening..." : "DM"}
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

