"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Award, CheckCircle2, MessageSquare, Star, StarHalf } from "lucide-react";
import { DashboardLayout } from "../../../../components/layout/DashboardLayout";
import { Avatar } from "../../../../components/ui/Avatar";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import { apiClient } from "../../../../lib/api";
import { useAuth } from "../../../../lib/useAuth";
import { useLanguage } from "../../../../lib/i18n";

type PublicUser = {
  _id: string;
  name: string;
  avatarUrl?: string;
  role: string;
  bio?: string;
  primaryTechnicalField?: string;
  roleOrStatus?: string;
  yearsOfExperience?: string;
  expertise?: Array<{ subject: string; proficiency: string }>;
  skillTags?: string[];
  availabilityStatus?: "available" | "online" | "busy" | "offline" | "in_session";
  points?: number;
  badges?: string[];
  expertRatingAverage?: number;
  expertReviewCount?: number;
};

type ExpertReview = {
  _id: string;
  by: {
    _id: string;
    name: string;
    avatarUrl?: string;
  };
  stars: number;
  comment?: string;
  createdAt?: string;
};

function initials(name?: string) {
  return (name || "User")
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

export default function PublicProfilePage() {
  const { t } = useLanguage();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const userId = params?.id || "";
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [reviews, setReviews] = useState<ExpertReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [dmLoading, setDmLoading] = useState(false);
  const [error, setError] = useState("");

  const isExpert = profile?.role === "expert";
  const isOwnProfile = currentUser?._id === userId;
  const availabilityLabel = useMemo(() => {
    if (profile?.availabilityStatus === "available" || profile?.availabilityStatus === "online") return "Available now";
    if (profile?.availabilityStatus === "busy") return "Busy";
    if (profile?.availabilityStatus === "in_session") return "In session";
    return "Offline";
  }, [profile?.availabilityStatus]);

  useEffect(() => {
    if (!userId) return;

    let mounted = true;
    async function loadProfile() {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get<{ user: PublicUser }>(`/api/users/${userId}`);
        if (!mounted) return;
        setProfile(res.data.user);

        if (res.data.user?.role === "expert") {
          const reviewRes = await apiClient.get<{
            reviews: ExpertReview[];
            expertRatingAverage?: number;
            expertReviewCount: number;
          }>(`/api/users/${userId}/reviews`);
          if (!mounted) return;
          setReviews(reviewRes.data.reviews || []);
          setProfile((current) =>
            current
              ? {
                  ...current,
                  expertRatingAverage: reviewRes.data.expertRatingAverage,
                  expertReviewCount: reviewRes.data.expertReviewCount,
                }
              : current
          );
        }
      } catch (err: any) {
        if (mounted) setError(err?.response?.data?.error?.message || "Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [userId]);

  async function startDm() {
    if (!profile || !isExpert || isOwnProfile) return;
    setDmLoading(true);
    setError("");
    try {
      const res = await apiClient.post<{ conversation: { _id: string } }>(
        "/api/dms/conversations",
        { expertId: profile._id }
      );
      router.push(`/dashboard/messages?conversation=${res.data.conversation._id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Failed to start direct message");
    } finally {
      setDmLoading(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout title={t("Profile")}>
        <div className="flex h-64 items-center justify-center text-neutral-500">{t("Loading profile...")}</div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout title={t("Profile")}>
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error || t("Profile not found.")}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={t("{name}'s Profile", { name: profile.name })} searchPlaceholder={t("Search experts, topics...")}>
      {error && (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      <section className="mb-6 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <Avatar size="xl" initials={initials(profile.name)} src={profile.avatarUrl} />
            <div className="min-w-0">
              <h2 className="break-words text-2xl font-bold text-neutral-950 dark:text-white">
                {profile.name}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant={isExpert ? "primary" : "default"}>
                  {isExpert ? "Mentor" : "Learner"}
                </Badge>
                <Badge variant={profile.availabilityStatus === "available" || profile.availabilityStatus === "online" ? "success" : "default"}>
                  {availabilityLabel}
                </Badge>
              </div>
              {profile.bio && (
                <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          {isExpert && !isOwnProfile && (
            <Button type="button" variant="primary" onClick={startDm} isLoading={dmLoading}>
              <MessageSquare className="mr-2 h-4 w-4" />
              DM
            </Button>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
            <h3 className="mb-4 text-lg font-bold text-neutral-950 dark:text-white">{t("Expertise")}</h3>
            <div className="flex flex-wrap gap-2">
              {(profile.expertise || []).length > 0 ? (
                profile.expertise!.map((item) => (
                  <Badge key={`${item.subject}-${item.proficiency}`} variant="primary">
                    {item.subject} ({item.proficiency})
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-neutral-500">{t("No expertise areas listed.")}</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
            <h3 className="mb-4 text-lg font-bold text-neutral-950 dark:text-white">{t("Reviews")}</h3>
            {!isExpert ? (
              <p className="text-sm text-neutral-500">{t("Reviews are available for mentors.")}</p>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("No reviews yet.")}</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review._id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
                    <div className="flex items-start gap-3">
                      <Avatar
                        size="sm"
                        initials={initials(review.by.name)}
                        src={review.by.avatarUrl}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-neutral-900 dark:text-white">
                            {review.by.name}
                          </p>
                          <ReviewStars rating={review.stars} />
                        </div>
                        {review.comment && (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                            {review.comment}
                          </p>
                        )}
                        {review.createdAt && (
                          <p className="mt-2 text-xs text-neutral-400">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-neutral-950 dark:text-white">
              <Award className="h-5 w-5 text-amber-500" />
              Reputation
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-neutral-500">{t("Points")}</span>
                <span className="font-bold text-neutral-950 dark:text-white">
                  {(profile.points || 0).toLocaleString()}
                </span>
              </div>
              {isExpert && (
                <div className="flex items-center justify-between gap-3">
                <span className="text-neutral-500">{t("Rating")}</span>
                  <span className="flex items-center gap-2 font-bold text-neutral-950 dark:text-white">
                    <ReviewStars rating={profile.expertRatingAverage || 0} />
                    {profile.expertRatingAverage?.toFixed(1) || "New"}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <span className="text-neutral-500">{t("Reviews")}</span>
                <span className="font-bold text-neutral-950 dark:text-white">
                  {profile.expertReviewCount || 0}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-neutral-950 dark:text-white">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Details
            </h3>
            <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
              <p>{profile.primaryTechnicalField || "No technical field listed"}</p>
              <p>{profile.roleOrStatus || "No role listed"}</p>
              <p>{profile.yearsOfExperience || "No experience listed"}</p>
            </div>
            {(profile.skillTags || []).length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {profile.skillTags!.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </DashboardLayout>
  );
}
