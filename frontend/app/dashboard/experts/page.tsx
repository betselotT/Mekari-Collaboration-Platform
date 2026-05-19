"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { ExpertCard } from "../../../components/features/ExpertCard";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { ArrowRight, CheckCircle2, Star, StarHalf, Users, X } from "lucide-react";
import { apiClient } from "../../../lib/api";

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
            className={`h-4 w-4 ${
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
        <div className="flex rounded-2xl bg-white p-1.5 shadow-lg shadow-neutral-900/5 ring-1 ring-neutral-200 dark:bg-white/5 dark:ring-white/10">
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
                className="rounded-xl p-1.5 text-amber-400 transition-all hover:scale-110 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400/40 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-amber-400/10"
                aria-label={`${index + 1} star${index === 0 ? "" : "s"}`}
              >
                <Icon
                  className={`h-7 w-7 ${
                    filled || half
                      ? "fill-amber-400 text-amber-400"
                      : "fill-transparent text-neutral-300 dark:text-neutral-600"
                  }`}
                />
              </button>
            );
          })}
        </div>
        <span className="min-w-[4.5rem] rounded-full bg-amber-50 px-3 py-1 text-center text-sm font-bold text-amber-800 shadow-sm ring-1 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-400/20">
          {displayValue === null ? "-- / 5" : `${displayValue.toFixed(1)} / 5`}
        </span>
      </div>
      <div className="text-xs text-neutral-500 dark:text-neutral-400">
        Click the left or right half of a star to choose half-step ratings.
      </div>
    </div>
  );
}

export default function ExpertsPage() {
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
    // Pre-fill the match page with this expert's top subject and tags
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
      setReviewMessage("Review posted.");

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
    <DashboardLayout title="Expert Network" searchPlaceholder="Search experts by name or skills...">
      {availabilityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 px-4 py-6 backdrop-blur-md">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mentor-unavailable-title"
            className="w-full max-w-md rounded-3xl border border-white/70 bg-white/95 p-5 shadow-2xl shadow-neutral-950/20 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/95"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-sm ring-1 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20">
                !
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="mentor-unavailable-title" className="text-base font-bold text-neutral-900 dark:text-white">
                  Mentor unavailable
                </h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Mentor isn't available right now. Try again later.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAvailabilityModalOpen(false)}
                className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setAvailabilityModalOpen(false)}
                className="inline-flex min-h-[40px] items-center justify-center rounded-2xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-600/20 transition-all hover:scale-[1.02] hover:bg-primary-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewsOpen && selectedExpert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/65 px-4 py-6 backdrop-blur-md">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="expert-reviews-title"
            className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-2xl shadow-neutral-950/20 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/95"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -left-12 top-10 h-36 w-36 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4 border-b border-neutral-200/80 bg-gradient-to-br from-white via-emerald-50/70 to-cyan-50/60 p-6 dark:border-white/10 dark:from-neutral-950 dark:via-emerald-950/30 dark:to-cyan-950/20">
              <div>
                <h2 id="expert-reviews-title" className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white">
                  Reviews for {selectedExpert.name}
                </h2>
                {selectedExpert.expertReviewCount ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-3 py-1.5 shadow-sm backdrop-blur dark:border-amber-400/20 dark:bg-white/10">
                    <ReviewStars rating={selectedExpert.expertRatingAverage || 0} />
                    <span className="text-sm font-bold text-neutral-950 dark:text-white">
                      {selectedExpert.expertRatingAverage?.toFixed(1)}
                    </span>
                    <span className="text-sm text-neutral-500">
                      ({selectedExpert.expertReviewCount} review{selectedExpert.expertReviewCount === 1 ? "" : "s"})
                    </span>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">No reviews yet</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setReviewsOpen(false)}
                className="rounded-full border border-neutral-200 bg-white/80 p-2 text-neutral-400 shadow-sm transition-all hover:scale-105 hover:bg-white hover:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15 dark:hover:text-neutral-200"
                aria-label="Close reviews"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative overflow-y-auto p-5">
              <div className="mb-5 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50/80 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                      Share your experience
                    </h3>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      Reviews help learners find the right expert faster.
                    </p>
                  </div>
                  {!showReviewForm && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowReviewForm(true);
                        setReviewMessage("");
                        setReviewError("");
                      }}
                      className="group inline-flex w-fit items-center gap-2 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-primary-400 dark:hover:text-primary-300"
                    >
                      <span className="border-b border-primary-300 pb-0.5 transition-colors group-hover:border-primary-600 dark:border-primary-700 dark:group-hover:border-primary-300">
                        Leave a review
                      </span>
                      <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      <span aria-hidden="true" className="hidden">
                        →
                      </span>
                    </button>
                  )}
                </div>

                {reviewMessage && !showReviewForm && (
                  <div className="mx-4 mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                    {reviewMessage}
                  </div>
                )}

                {showReviewForm && (
                  <form
                    onSubmit={submitReview}
                    className="border-t border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-950"
                  >
                    <div className="mb-4">
                      <StarRatingInput
                        value={reviewStars}
                        onChange={setReviewStars}
                        disabled={reviewSubmitting}
                      />
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        Comment optional
                      </span>
                      <textarea
                        value={reviewComment}
                        onChange={(event) => setReviewComment(event.target.value)}
                        maxLength={1000}
                        rows={4}
                        disabled={reviewSubmitting}
                        placeholder="What stood out about this expert's help?"
                        className="w-full resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm leading-6 text-neutral-900 shadow-inner shadow-white/40 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:shadow-none"
                      />
                    </label>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-h-5 text-xs">
                        {reviewError && <span className="text-red-600 dark:text-red-400">{reviewError}</span>}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={reviewSubmitting}
                          onClick={() => {
                            setShowReviewForm(false);
                            setReviewStars(null);
                            setReviewComment("");
                            setReviewError("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          isLoading={reviewSubmitting}
                          disabled={reviewStars === null}
                          className="rounded-xl shadow-lg shadow-primary-600/20"
                        >
                          Post review
                        </Button>
                      </div>
                    </div>
                  </form>
                )}
              </div>

              {reviewsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="flex gap-3">
                        <div className="h-10 w-10 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
                        <div className="flex-1 space-y-3">
                          <div className="h-4 w-32 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
                          <div className="h-3 w-24 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-800" />
                          <div className="h-12 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/70 p-8 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 ring-1 ring-amber-100 dark:bg-amber-400/10 dark:ring-amber-400/20">
                    <Star className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold text-neutral-950 dark:text-white">No reviews yet</p>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    Ratings will appear here after learners review this expert.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div
                      key={review._id}
                      className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar
                          size="md"
                          src={review.by.avatarUrl}
                          initials={initials(review.by.name)}
                          className="ring-2 ring-white dark:ring-neutral-800"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-neutral-900 dark:text-white">
                              {review.by.name}
                            </p>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400">
                              {review.createdAt
                                ? new Intl.DateTimeFormat("en", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  }).format(new Date(review.createdAt))
                                : "Recently"}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <ReviewStars rating={review.stars} />
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                              {review.stars.toFixed(1)}
                            </span>
                          </div>
                          {review.comment && (
                            <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                              {review.comment}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="relative mb-8 overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-6 shadow-xl shadow-emerald-500/5 dark:border-white/10 dark:from-neutral-950 dark:via-neutral-900 dark:to-emerald-950/40">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700 shadow-sm backdrop-blur dark:border-emerald-400/20 dark:bg-white/10 dark:text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
              Expert Network
            </div>
            <h2 className="max-w-3xl text-3xl font-bold tracking-tight text-neutral-950 dark:text-white md:text-4xl">
              Find the right mentor for your next technical move.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-300 md:text-base">
              Browse verified peers by discipline, reputation, availability, and real learner reviews.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:min-w-[420px]">
            {[
              { label: "Experts", value: experts.length, Icon: Users },
              { label: "Online", value: availableExperts, Icon: CheckCircle2 },
              {
                label: "Avg rating",
                value: averageNetworkRating ? averageNetworkRating.toFixed(1) : "New",
                Icon: Star,
              },
            ].map((stat) => {
              const Icon = stat.Icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/70 bg-white/75 p-3 shadow-lg shadow-neutral-900/5 backdrop-blur dark:border-white/10 dark:bg-white/10"
                >
                  <Icon className="mb-2 h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                  <div className="text-xl font-bold text-neutral-950 dark:text-white">{stat.value}</div>
                  <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Filter tabs */}
      <div className="mb-8 flex flex-wrap gap-2 overflow-x-auto rounded-2xl border border-neutral-200 bg-white/70 p-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
        {filterOptions.map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
              selectedFilter === filter
                ? "bg-neutral-950 text-white shadow-lg shadow-neutral-900/20 dark:bg-white dark:text-neutral-950"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-[430px] overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900"
            >
              <div className="h-32 animate-pulse bg-gradient-to-br from-neutral-100 via-emerald-100 to-cyan-100 dark:from-neutral-800 dark:via-emerald-950 dark:to-cyan-950" />
              <div className="space-y-4 p-5">
                <div className="mx-auto -mt-12 h-20 w-20 animate-pulse rounded-full bg-neutral-200 ring-4 ring-white dark:bg-neutral-700 dark:ring-neutral-900" />
                <div className="mx-auto h-5 w-36 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />
                <div className="mx-auto h-4 w-48 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-800" />
                <div className="h-10 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
                <div className="flex justify-center gap-2">
                  <div className="h-6 w-16 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-800" />
                  <div className="h-6 w-20 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-800" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-11 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
                  <div className="h-11 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-300 bg-white/70 p-10 text-center shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20">
            <Users className="h-6 w-6" />
          </div>
          <p className="text-base font-bold text-neutral-950 dark:text-white">
            {experts.length === 0 ? "No experts found" : `No experts match "${selectedFilter}"`}
          </p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
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
        <p className="mt-6 text-center text-xs text-neutral-400 dark:text-neutral-600">
          Showing {filtered.length} of {experts.length} expert{experts.length !== 1 ? "s" : ""}
        </p>
      )}
    </DashboardLayout>
  );
}
