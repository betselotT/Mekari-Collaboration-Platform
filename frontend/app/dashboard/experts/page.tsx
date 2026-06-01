"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { ExpertCard } from "../../../components/features/ExpertCard";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { ArrowRight, CheckCircle2, Star, StarHalf, Users, X } from "lucide-react";
import { apiClient } from "../../../lib/api";
import { useLanguage } from "../../../lib/i18n";
import { ContourField } from "../../../components/visual/ContourField";

interface DBExpert {
  _id: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  expertise: Array<{ subject: string; proficiency: string }>;
  skillTags: string[];
  availabilityStatus: "online" | "busy" | "offline" | "in_session";
  points: number;
  badges: string[];
  role: string;
  expertRatingAverage?: number;
  expertReviewCount?: number;
}

interface ExpertReview {
  _id: string;
  by: {
    _id: string;
    name: string;
    avatarUrl?: string;
  };
  stars: number;
  comment?: string;
  createdAt?: string;
}

type ReviewStats = {
  expertRatingAverage?: number;
  expertReviewCount: number;
};

function mapStatus(
  s: DBExpert["availabilityStatus"]
): "available" | "available_in_2h" | "away" {
  if (s === "online") return "available";
  if (s === "busy" || s === "in_session") return "available_in_2h";
  return "away";
}

function buildTitle(expert: DBExpert): string {
  if (expert.expertise.length === 0) return expert.role === "admin" ? "Admin" : "Member";
  const top = expert.expertise[0];
  const level =
    top.proficiency === "expert"
      ? "Expert"
      : top.proficiency === "advanced"
      ? "Advanced"
      : top.proficiency === "intermediate"
      ? "Intermediate"
      : "Junior";
  return `${level} - ${top.subject}`;
}

function buildSkills(expert: DBExpert): string[] {
  const subjects = expert.expertise.map((e) => e.subject);
  const tags = expert.skillTags;
  const combined = [...subjects, ...tags];
  return Array.from(new Set(combined)).slice(0, 5);
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index + 1 <= rating;
        const half = !filled && rating - index >= 0.5;
        const Icon = half ? StarHalf : Star;
        return (
          <Icon
            key={index}
            className={`h-3.5 w-3.5 ${
              filled || half
                ? "fill-amber-400 text-amber-400"
                : "text-neutral-300 dark:text-neutral-600"
            }`}
          />
        );
      })}
    </div>
  );
}

function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value;

  function valueFromPointer(event: React.MouseEvent<HTMLButtonElement>, index: number) {
    const rect = event.currentTarget.getBoundingClientRect();
    const isLeftHalf = event.clientX - rect.left < rect.width / 2;
    return index + (isLeftHalf ? 0.5 : 1);
  }

  return (
    <div className="space-y-2" onMouseLeave={() => setHoverValue(null)}>
      <div className="flex items-center gap-3">
        <div className="flex rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-neutral-200 dark:bg-white/5 dark:ring-white/10">
          {Array.from({ length: 5 }).map((_, index) => {
            const filled = displayValue !== null && index + 1 <= displayValue;
            const half = displayValue !== null && !filled && displayValue - index >= 0.5;
            const Icon = half ? StarHalf : Star;
            return (
              <button
                key={index}
                type="button"
                disabled={disabled}
                onMouseMove={(event) => setHoverValue(valueFromPointer(event, index))}
                onFocus={() => setHoverValue(value ?? index + 1)}
                onClick={(event) => onChange(valueFromPointer(event, index))}
                className="rounded-lg p-1.5 text-amber-400 transition-all hover:scale-110 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400/40 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-amber-400/10"
                aria-label={`${index + 1} star${index === 0 ? "" : "s"}`}
              >
                <Icon
                  className={`h-6 w-6 ${
                    filled || half
                      ? "fill-amber-400 text-amber-400"
                      : "fill-transparent text-neutral-300 dark:text-neutral-600"
                  }`}
                />
              </button>
            );
          })}
        </div>
        <span className="min-w-[4rem] rounded-full bg-amber-50 px-2.5 py-1 text-center text-xs font-bold text-amber-800 shadow-sm ring-1 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-400/20">
          {displayValue === null ? "-- / 5" : `${displayValue.toFixed(1)} / 5`}
        </span>
      </div>
      <div className="text-[11px] text-neutral-400 dark:text-neutral-555">
        Click the left or right half of a star to choose half-step ratings.
      </div>
    </div>
  );
}

export default function ExpertsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [experts, setExperts] = useState<DBExpert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [availabilityModalOpen, setAvailabilityModalOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [selectedExpert, setSelectedExpert] = useState<DBExpert | null>(null);
  const [reviews, setReviews] = useState<ExpertReview[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewStars, setReviewStars] = useState<number | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");

  useEffect(() => {
    apiClient
      .get<{ experts: DBExpert[] }>("/api/users/experts")
      .then((res) => setExperts(res.data.experts || []))
      .catch((e) =>
          setError(e?.response?.data?.error?.message || "Failed to load experts")
      )
      .finally(() => setLoading(false));
  }, []);

  // Build filter options from actual expertise subjects
  const filterOptions = useMemo(() => {
    const subjects = new Set<string>();
    experts.forEach((e) => e.expertise.forEach((x) => subjects.add(x.subject)));
    return ["All", ...Array.from(subjects).sort()];
  }, [experts]);

  const filtered = useMemo(() => {
    if (selectedFilter === "All") return experts;
    return experts.filter((e) =>
      e.expertise.some(
        (x) => x.subject.toLowerCase() === selectedFilter.toLowerCase()
      )
    );
  }, [experts, selectedFilter]);

  const reviewedExperts = experts.filter((expert) => (expert.expertReviewCount || 0) > 0);
  const averageNetworkRating =
    reviewedExperts.length === 0
      ? undefined
      : reviewedExperts.reduce((sum, expert) => sum + (expert.expertRatingAverage || 0), 0) /
        reviewedExperts.length;
  const availableExperts = experts.filter((expert) => expert.availabilityStatus === "online").length;

  function handleConsult(expert: DBExpert) {
    const subject = expert.expertise[0]?.subject || "";
    const tags = buildSkills(expert).join(",");
    router.push(
      `/dashboard/match?subject=${encodeURIComponent(subject)}&tags=${encodeURIComponent(tags)}`
    );
  }

  async function handleDm(expert: DBExpert) {
    if (expert.availabilityStatus !== "online") {
      setAvailabilityModalOpen(true);
      return;
    }

    try {
      const res = await apiClient.post<{ conversation: { _id: string } }>(
        "/api/dms/conversations",
        { expertId: expert._id }
      );
      router.push(`/dashboard/messages?conversation=${res.data.conversation._id}`);
    } catch (e: any) {
      const message = e?.response?.data?.error?.message || "Failed to start direct message";
      if (message === "Mentor isn't available right now. Try again later.") {
        setAvailabilityModalOpen(true);
      } else {
        setError(message);
      }
    }
  }

  async function openReviews(expert: DBExpert) {
    setSelectedExpert(expert);
    setReviewsOpen(true);
    setReviewsLoading(true);
    setError(null);
    setReviewError("");
    setReviewMessage("");
    setShowReviewForm(false);
    setReviewStars(null);
    setReviewComment("");
    try {
      const res = await apiClient.get<{ reviews: ExpertReview[] }>(
        `/api/users/${expert._id}/reviews`
      );
      setReviews(res.data.reviews || []);
    } catch (e: any) {
      setReviews([]);
      setError(e?.response?.data?.error?.message || "Failed to load reviews");
    } finally {
      setReviewsLoading(false);
    }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedExpert || reviewStars === null) return;

    setReviewSubmitting(true);
    setReviewError("");
    setReviewMessage("");

    try {
      const res = await apiClient.post<ReviewStats>(
        `/api/users/${selectedExpert._id}/reviews`,
        {
          stars: reviewStars,
          comment: reviewComment.trim() || undefined,
        }
      );

      const nextExpert = {
        ...selectedExpert,
        expertRatingAverage: res.data.expertRatingAverage,
        expertReviewCount: res.data.expertReviewCount,
      };

      setSelectedExpert(nextExpert);
      setExperts((current) =>
        current.map((expert) => (expert._id === nextExpert._id ? nextExpert : expert))
      );
      setReviewComment("");
      setReviewMessage("Review posted successfully.");

      const reviewsRes = await apiClient.get<{ reviews: ExpertReview[] }>(
        `/api/users/${selectedExpert._id}/reviews`
      );
      setReviews(reviewsRes.data.reviews || []);
      setShowReviewForm(false);
      setReviewStars(null);
    } catch (err: any) {
      setReviewError(err.response?.data?.error?.message || "Failed to post review.");
    } finally {
      setReviewSubmitting(false);
    }
  }

  return (
    <DashboardLayout title={t("Expert Network")} searchPlaceholder={t("Search experts by name or skills...")}>
      {availabilityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 px-4 py-6 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mentor-unavailable-title"
            className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 shadow-sm ring-1 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20">
                !
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="mentor-unavailable-title" className="text-sm font-bold text-neutral-900 dark:text-white">
                  Mentor unavailable
                </h2>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Mentor isn't available right now. Try again later.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAvailabilityModalOpen(false)}
                className="rounded-full p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200"
              aria-label={t("Close dialog")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setAvailabilityModalOpen(false)}
                className="inline-flex min-h-[36px] items-center justify-center rounded-xl bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-primary-700 active:scale-[0.99]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewsOpen && selectedExpert && (() => {
        /* ── Compute rating distribution for the bar chart ── */
        const distribution = [5, 4, 3, 2, 1].map((star) => {
          const count = reviews.filter((r) => Math.round(r.stars) === star).length;
          return { star, count, pct: reviews.length ? (count / reviews.length) * 100 : 0 };
        });

        return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 px-4 py-6 backdrop-blur-md"
          onClick={(e) => { if (e.target === e.currentTarget) setReviewsOpen(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="expert-reviews-title"
            className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-2xl dark:border-neutral-700/60 dark:bg-neutral-900"
            style={{ animation: "reviewModalIn 0.25s cubic-bezier(0.16,1,0.3,1)" }}
          >
            {/* ── Inline keyframes for entrance animation ── */}
            <style>{`
              @keyframes reviewModalIn {
                from { opacity: 0; transform: translateY(12px) scale(0.97); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
              }
              @keyframes starPulse {
                0%, 100% { transform: scale(1); }
                50%      { transform: scale(1.08); }
              }
            `}</style>

            {/* ════════════════════════════════════════════════
                 SECTION 1 — Rating Summary Hero
                ════════════════════════════════════════════════ */}
            <div className="relative shrink-0 border-b border-neutral-100 dark:border-neutral-800">
              {/* Ambient glow */}
              <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-amber-300/8 blur-3xl dark:bg-amber-500/5" />
              <div className="pointer-events-none absolute -left-16 top-6 h-36 w-36 rounded-full bg-primary-400/6 blur-3xl dark:bg-primary-500/4" />

              {/* Close button */}
              <button
                type="button"
                onClick={() => setReviewsOpen(false)}
                className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100/80 text-neutral-400 backdrop-blur transition-all hover:bg-neutral-200 hover:text-neutral-700 dark:bg-neutral-800/80 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                    aria-label={t("Close reviews")}
              >
                <X className="h-4 w-4" />
              </button>

              <div className="relative px-6 pb-5 pt-6">
                <h2
                  id="expert-reviews-title"
                  className="pr-10 text-lg font-bold tracking-tight text-neutral-900 dark:text-white"
                >
                  {selectedExpert.name}
                </h2>
                <p className="mt-0.5 text-[13px] font-medium text-neutral-400 dark:text-neutral-500">
                  Expert Reviews
                </p>

                {/* Rating summary card */}
                {selectedExpert.expertReviewCount ? (
                  <div className="mt-5 flex items-start gap-5">
                    {/* Big rating number */}
                    <div className="flex flex-col items-center">
                      <span className="text-[42px] font-extrabold leading-none tracking-tighter text-neutral-900 dark:text-white">
                        {selectedExpert.expertRatingAverage?.toFixed(1)}
                      </span>
                      <div className="mt-1.5 flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const rating = selectedExpert.expertRatingAverage || 0;
                          const filled = i + 1 <= rating;
                          const half = !filled && rating - i >= 0.5;
                          const Icon = half ? StarHalf : Star;
                          return (
                            <Icon
                              key={i}
                              className={`h-4 w-4 ${
                                filled || half
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-neutral-200 dark:text-neutral-700"
                              }`}
                            />
                          );
                        })}
                      </div>
                      <span className="mt-1.5 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500">
                        {selectedExpert.expertReviewCount} review{selectedExpert.expertReviewCount === 1 ? "" : "s"}
                      </span>
                    </div>

                    {/* Distribution bars */}
                    {!reviewsLoading && reviews.length > 0 && (
                      <div className="flex flex-1 flex-col justify-center gap-[6px] pt-1">
                        {distribution.map((d) => (
                          <div key={d.star} className="flex items-center gap-2">
                            <span className="w-4 text-right text-[11px] font-semibold text-neutral-400 dark:text-neutral-500">
                              {d.star}
                            </span>
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                            <div className="relative h-[6px] flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                              <div
                                className="absolute inset-y-0 left-0 rounded-full bg-amber-400 transition-all duration-500 ease-out"
                                style={{ width: `${d.pct}%` }}
                              />
                            </div>
                            <span className="w-6 text-right text-[10px] font-medium text-neutral-300 dark:text-neutral-600">
                              {d.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-5 flex items-center gap-3 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/60 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-800/30">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-400 dark:bg-amber-400/10">
                      <Star className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{t("No ratings yet")}</p>
                      <p className="text-[11px] text-neutral-400 dark:text-neutral-500">{t("Be the first to share your experience.")}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ════════════════════════════════════════════════
                 SECTION 2 — Scrollable Body
                ════════════════════════════════════════════════ */}
            <div className="relative flex-1 overflow-y-auto scroll-smooth">
              <div className="px-6 py-5 space-y-5">

                {/* ── Leave a Review Section ── */}
                <div className="rounded-2xl border border-neutral-100 bg-gradient-to-b from-neutral-50/80 to-white dark:border-neutral-800 dark:from-neutral-800/40 dark:to-neutral-900 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
                        <Star className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-[13px] font-bold text-neutral-800 dark:text-neutral-100">
                          Share your experience
                        </h3>
                        <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                          Help others find great mentors
                        </p>
                      </div>
                    </div>
                    {!showReviewForm && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowReviewForm(true);
                          setReviewMessage("");
                          setReviewError("");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-primary-700 hover:shadow-md active:scale-[0.97] dark:bg-primary-500 dark:hover:bg-primary-400"
                      >
                        Write review
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {reviewMessage && !showReviewForm && (
                    <div className="mx-5 mb-4 flex items-center gap-2.5 rounded-xl border border-emerald-200/60 bg-emerald-50/80 px-4 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">{reviewMessage}</span>
                    </div>
                  )}

                  {showReviewForm && (
                    <form
                      onSubmit={submitReview}
                      className="border-t border-neutral-100 bg-white px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900"
                    >
                      <div className="mb-5">
                        <span className="mb-2.5 block text-[11px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                          Your rating
                        </span>
                        <StarRatingInput
                          value={reviewStars}
                          onChange={setReviewStars}
                          disabled={reviewSubmitting}
                        />
                      </div>
                      <label className="block">
                        <span className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                          Comment <span className="normal-case tracking-normal font-medium">(optional)</span>
                        </span>
                        <textarea
                          value={reviewComment}
                          onChange={(event) => setReviewComment(event.target.value)}
                          maxLength={1000}
                          rows={3}
                          disabled={reviewSubmitting}
                  placeholder={t("What stood out about this expert's guidance?")}
                          className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-[13px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/10 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-white dark:placeholder:text-neutral-600 dark:focus:border-primary-500"
                        />
                      </label>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-h-[18px] text-xs">
                          {reviewError && (
                            <span className="inline-flex items-center gap-1 font-semibold text-red-500">
                              <span className="inline-block h-1 w-1 rounded-full bg-red-500" />
                              {reviewError}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={reviewSubmitting}
                            onClick={() => {
                              setShowReviewForm(false);
                              setReviewStars(null);
                              setReviewComment("");
                              setReviewError("");
                            }}
                            className="rounded-xl px-4 py-2 text-xs font-semibold text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={reviewStars === null || reviewSubmitting}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-primary-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-400"
                          >
                            {reviewSubmitting && (
                              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            )}
                            {reviewSubmitting ? "Posting…" : "Post review"}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>

                {/* ── Reviews List ── */}
                {reviewsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-neutral-100 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-800/30"
                      >
                        <div className="flex gap-3.5">
                          <div className="h-10 w-10 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />
                          <div className="flex-1 space-y-2.5">
                            <div className="flex justify-between">
                              <div className="h-3.5 w-28 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700" />
                              <div className="h-3 w-16 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800" />
                            </div>
                            <div className="h-3 w-20 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800" />
                            <div className="h-4 w-full animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="flex flex-col items-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/30 py-10 text-center dark:border-neutral-800 dark:bg-neutral-800/20">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-400 dark:bg-amber-500/10 dark:text-amber-300">
                      <Star className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-bold text-neutral-900 dark:text-white">{t("No reviews yet")}</p>
                    <p className="mt-1 max-w-[240px] text-xs text-neutral-400 dark:text-neutral-500">
                      Ratings will appear here after learners review this expert.
                    </p>
                  </div>
                ) : (
                  <div>
                    <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                      All Reviews ({reviews.length})
                    </h3>
                    <div className="space-y-3">
                      {reviews.map((review) => (
                        <div
                          key={review._id}
                          className="group rounded-2xl border border-neutral-100 bg-white p-4 transition-all hover:border-neutral-200 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-800/20 dark:hover:border-neutral-700"
                        >
                          <div className="flex items-start gap-3.5">
                            <Avatar
                              size="md"
                              src={review.by.avatarUrl}
                              initials={initials(review.by.name)}
                              className="shrink-0 ring-2 ring-white shadow-sm dark:ring-neutral-800"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[13px] font-bold text-neutral-900 dark:text-white">
                                  {review.by.name}
                                </p>
                                <time className="shrink-0 text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                                  {review.createdAt
                                    ? new Intl.DateTimeFormat("en", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      }).format(new Date(review.createdAt))
                                    : "Recently"}
                                </time>
                              </div>
                              <div className="mt-1.5 flex items-center gap-2">
                                <div className="flex items-center gap-0.5">
                                  {Array.from({ length: 5 }).map((_, i) => {
                                    const filled = i + 1 <= review.stars;
                                    const half = !filled && review.stars - i >= 0.5;
                                    const Icon = half ? StarHalf : Star;
                                    return (
                                      <Icon
                                        key={i}
                                        className={`h-3.5 w-3.5 ${
                                          filled || half
                                            ? "fill-amber-400 text-amber-400"
                                            : "text-neutral-200 dark:text-neutral-700"
                                        }`}
                                      />
                                    );
                                  })}
                                </div>
                                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                                  {review.stars.toFixed(1)}
                                </span>
                              </div>
                              {review.comment && (
                                <p className="mt-2.5 text-[13px] leading-[1.6] text-neutral-600 dark:text-neutral-400">
                                  {review.comment}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Modern, Clean Green-Free Statistics & Header section */}
      <section className="relative mb-8 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-neutral-900/75">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-400/5 blur-3xl" />
        <ContourField className="pointer-events-none absolute -right-24 -top-16 h-52 w-[350px] rotate-[-8deg] opacity-[0.14] dark:opacity-[0.24]" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h2 className="max-w-3xl text-2xl font-bold tracking-tight text-neutral-950 dark:text-white md:text-3xl">
              Find the right mentor for your next technical move.
            </h2>
            <p className="mt-2.5 max-w-2xl text-xs leading-relaxed text-neutral-500 dark:text-neutral-400 font-medium">
              Browse verified peers by discipline, reputation, availability, and real learner reviews.
            </p>
          </div>
          
          <div className="grid grid-cols-3 gap-3 sm:min-w-[360px]">
            {[
              { label: "Experts", value: experts.length, Icon: Users, color: "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/20" },
              { label: "Online", value: availableExperts, Icon: CheckCircle2, color: "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/20" },
              {
                label: "Avg Rating",
                value: averageNetworkRating ? averageNetworkRating.toFixed(1) : "New",
                Icon: Star,
                color: "text-amber-500 bg-amber-50 dark:bg-amber-950/20"
              },
            ].map((stat) => {
              const Icon = stat.Icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/70 bg-white/75 p-3.5 shadow-sm backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-850"
                >
                  <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg ${stat.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-lg font-bold text-neutral-950 dark:text-white leading-none">{stat.value}</div>
                  <div className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 mt-1 uppercase tracking-wide">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Filter tabs */}
      <div className="mb-8 flex flex-wrap gap-1.5 overflow-x-auto rounded-xl border border-neutral-200 bg-white/70 p-1.5 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/50">
        {filterOptions.map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-all duration-200 ${
              selectedFilter === filter
                ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-rose-250 bg-rose-50 px-3.5 py-2 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[380px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="h-28 animate-pulse bg-gradient-to-br from-neutral-100 to-cyan-50/50 dark:from-neutral-800 dark:to-cyan-950/20" />
              <div className="space-y-4 p-5">
                <div className="mx-auto -mt-10 h-16 w-16 animate-pulse rounded-full bg-neutral-200 ring-4 ring-white dark:bg-neutral-700 dark:ring-neutral-900" />
                <div className="mx-auto h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="mx-auto h-3 w-40 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
                <div className="h-8 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
                <div className="flex justify-center gap-2">
                  <div className="h-5 w-14 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
                  <div className="h-5 w-16 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/70 p-10 text-center shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600 ring-1 ring-primary-100 dark:bg-primary-400/10 dark:text-primary-300 dark:ring-primary-400/20">
            <Users className="h-5 w-5" />
          </div>
          <p className="text-sm font-bold text-neutral-950 dark:text-white">
            {experts.length === 0 ? "No experts found" : `No experts match "${selectedFilter}"`}
          </p>
          <p className="mt-1.5 text-xs text-neutral-400 dark:text-neutral-500 font-medium">
            Try a different specialty filter or check back when more mentors are available.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((expert) => (
            <ExpertCard
              key={expert._id}
              name={expert.name}
              title={buildTitle(expert)}
              company=""
              rating={expert.expertRatingAverage}
              reviewCount={expert.expertReviewCount || 0}
              image={expert.avatarUrl}
              skills={buildSkills(expert)}
              status={mapStatus(expert.availabilityStatus)}
              onConsult={() => handleConsult(expert)}
              onDm={() => handleDm(expert)}
              onReviewsClick={() => openReviews(expert)}
            />
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <p className="mt-6 text-center text-xs text-neutral-400 dark:text-neutral-600 font-medium">
          Showing {filtered.length} of {experts.length} expert{experts.length !== 1 ? "s" : ""}
        </p>
      )}
    </DashboardLayout>
  );
}
