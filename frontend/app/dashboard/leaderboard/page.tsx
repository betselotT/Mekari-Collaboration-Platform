// Represents leaderboard participant data returned from the gamification API
"use client";

import { type ReactNode, useEffect, useState } from "react";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { Card } from "../../../components/ui/Card";
import { Avatar } from "../../../components/ui/Avatar";
import { Badge } from "../../../components/ui/Badge";
import { Award, BriefcaseBusiness, CalendarDays, Clock, Star, Tag, X, Zap } from "lucide-react";
import { apiClient } from "../../../lib/api";
import { useLanguage } from "../../../lib/i18n";

type LeaderboardTab = "experts" | "learners";

type LeaderboardUser = {
  _id: string;
  rank: number;
  name: string;
  avatarUrl?: string;
  points: number;
  badges: string[];
  badgeCounts?: Record<string, number>;
  expertise: Array<{ subject: string; proficiency: string }>;
  skillTags: string[];
  role: string;
  createdAt?: string;
};

type PublicLeaderboardProfile = LeaderboardUser & {
  bio?: string;
  primaryTechnicalField?: string;
  roleOrStatus?: string;
  yearsOfExperience?: string;
  availabilityStatus?: "online" | "busy" | "offline" | "in_session";
  expertRatingAverage?: number;
  expertReviewCount?: number;
};
// Generates avatar initials from a user's full name
function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
function joinedLabel(createdAt?: string) {
  if (!createdAt) return "Joined Mekari";
  return `Joined ${new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(createdAt))}`;
}

function expertiseLabel(user: LeaderboardUser) {
  const primary = user.expertise?.[0];
  if (primary) return `${primary.subject} · ${primary.proficiency}`;
  if (user.skillTags?.length) return user.skillTags.slice(0, 3).join(", ");
  return user.role === "expert" ? "Mentor" : "Learner";
}
function roleLabel(role: string) {
  return role === "expert" ? "Mentor" : "Learner";
}

function availabilityLabel(status?: PublicLeaderboardProfile["availabilityStatus"]) {
  if (status === "online") return "Available now";
  if (status === "busy") return "Busy";
  if (status === "in_session") return "In session";
  return "Offline";
}

export default function LeaderboardPage() {
  const { t } = useLanguage();
  const [learners, setLearners] = useState<LeaderboardUser[]>([]);
  const [experts, setExperts] = useState<LeaderboardUser[]>([]);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("experts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<PublicLeaderboardProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  async function openUserModal(user: LeaderboardUser) {
    setSelectedUser(user);
    setSelectedProfile({ ...user });
    setProfileError("");
    setProfileLoading(true);
    try {
      const res = await apiClient.get<{ user: PublicLeaderboardProfile }>(`/api/users/${user._id}`);
      setSelectedProfile({ ...user, ...res.data.user, rank: user.rank });
    } catch (err: any) {
      setProfileError(err.response?.data?.error?.message || t("Failed to load profile."));
    } finally {
      setProfileLoading(false);
    }
  }

  function closeUserModal() {
    setSelectedUser(null);
    setSelectedProfile(null);
    setProfileError("");
    setProfileLoading(false);
  }

  useEffect(() => {
    async function loadLeaderboards() {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get<{
          learners: LeaderboardUser[];
          experts: LeaderboardUser[];
        }>("/api/gamification/leaderboards");
        setLearners(res.data.learners || []);
        setExperts(res.data.experts || []);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || t("Failed to load leaderboards."));
      } finally {
        setLoading(false);
      }
    }

    loadLeaderboards();
  }, []);

  return (
    <DashboardLayout title={t("Leaderboard")}>
      <div className="mb-8">
        <p className="text-neutral-600 dark:text-neutral-400">
          {t("Learners and mentors are ranked separately so progress is fair and easy to scan.")}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex w-full max-w-md rounded bg-neutral-100 p-1 dark:bg-neutral-900">
            <LeaderboardTabButton
              active={activeTab === "experts"}
              count={experts.length}
              label={t("Experts")}
              onClick={() => setActiveTab("experts")}
            />
            <LeaderboardTabButton
              active={activeTab === "learners"}
              count={learners.length}
              label={t("Learners")}
              onClick={() => setActiveTab("learners")}
            />
          </div>

          {activeTab === "experts" ? (
            <LeaderboardSection title={t("Expert Leaderboard")} description={t("Top mentors by earned points.")} users={experts} onUserClick={openUserModal} />
          ) : (
            <LeaderboardSection title={t("Learner Leaderboard")} description={t("Top learners by earned points.")} users={learners} onUserClick={openUserModal} />
          )}
        </div>
      )}

      {selectedUser && (
        <LeaderboardProfileModal
          error={profileError}
          loading={profileLoading}
          onClose={closeUserModal}
          profile={selectedProfile || selectedUser}
        />
      )}
    </DashboardLayout>
  );
}

function LeaderboardTabButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-white text-primary-700 shadow-sm dark:bg-neutral-800 dark:text-primary-300"
          : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      }`}
    >
      <span>{label}</span>
      <span
        className={`rounded px-1.5 py-0.5 text-xs ${
          active
            ? "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300"
            : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function LeaderboardSection({
  title,
  description,
  users,
  onUserClick,
}: {
  title: string;
  description: string;
  users: LeaderboardUser[];
  onUserClick: (user: LeaderboardUser) => void;
}) {
  const { t } = useLanguage();
  const topUsers = users.slice(0, 3);
  const tableUsers = users.slice(3);

  return (
    <section>
      <div className="mb-5">
        <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">{title}</h3>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
      </div>

      {users.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <p className="font-semibold text-neutral-900 dark:text-white">{t("No entries yet.")}</p>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {t("Users will appear here once they earn points.")}
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-6 md:grid-cols-3">
            {topUsers.map((user) => (
              <Card
                key={user._id}
                role="button"
                tabIndex={0}
                onClick={() => onUserClick(user)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onUserClick(user);
                  }
                }}
                className={`relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-neutral-950 ${
                  user.rank === 1
                    ? "border-primary-500 dark:border-primary-400 ring-2 ring-primary-500 ring-opacity-20"
                    : "hover:border-primary-200 hover:shadow-md dark:hover:border-primary-800"
                }`}
              >
                <div className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white font-bold shadow-lg">
                  {user.rank}
                </div>
                <div className="text-center">
                  <Avatar size="xl" initials={initials(user.name)} src={user.avatarUrl} />
                  <h4 className="mt-4 text-lg font-bold text-neutral-900 dark:text-white">{user.name}</h4>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">{expertiseLabel(user)}</p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Zap className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                    <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {user.points.toLocaleString()} pts
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-500">{joinedLabel(user.createdAt)}</p>
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-neutral-200 dark:border-neutral-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-400">{t("Rank")}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-400">{t("Contributor")}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-400">{t("Profile")}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-400">{t("Badges")}</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-400">{t("Points")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {tableUsers.map((user) => (
                    <tr
                      key={user._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onUserClick(user)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onUserClick(user);
                        }
                      }}
                      className="cursor-pointer transition-colors hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none dark:hover:bg-neutral-800 dark:focus:bg-neutral-800"
                    >
                      <td className="px-6 py-4 text-sm font-bold text-neutral-900 dark:text-white">{user.rank}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar size="md" initials={initials(user.name)} src={user.avatarUrl} />
                          <div>
                            <p className="text-sm font-semibold text-neutral-900 dark:text-white">{user.name}</p>
                            <p className="text-xs text-neutral-600 dark:text-neutral-400">{joinedLabel(user.createdAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">{expertiseLabel(user)}</td>
                      <td className="px-6 py-4">
                        {user.badges?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {user.badges.slice(0, 2).map((badge) => (
                              <Badge key={badge} variant="primary">
                                {(user.badgeCounts?.[badge] || 1) > 1
                                  ? `${badge} x${user.badgeCounts?.[badge]}`
                                  : badge}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <Star className="h-4 w-4 text-neutral-300 dark:text-neutral-600" />
                            <Star className="h-4 w-4 text-neutral-300 dark:text-neutral-600" />
                            <Star className="h-4 w-4 text-neutral-300 dark:text-neutral-600" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-primary-600 dark:text-primary-400">
                        {user.points.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-200 px-6 py-4 dark:border-neutral-700">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {t("Showing")} {users.length} {t(users.length === 1 ? "contributor" : "contributors")}
              </p>
            </div>
          </Card>
        </>
      )}
    </section>
  );
}

function LeaderboardProfileModal({
  error,
  loading,
  onClose,
  profile,
}: {
  error: string;
  loading: boolean;
  onClose: () => void;
  profile: PublicLeaderboardProfile | LeaderboardUser;
}) {
  const { t } = useLanguage();
  const isExpert = profile.role === "expert";
  const publicProfile = profile as PublicLeaderboardProfile;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 px-4 py-6"
      role="dialog"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-4 dark:border-neutral-700 dark:bg-neutral-900">
          <div>
            <p className="text-xs font-semibold uppercase text-primary-600 dark:text-primary-400">
              {t(roleLabel(profile.role))} {t("Profile")}
            </p>
            <h2 className="text-lg font-bold text-neutral-950 dark:text-white">{profile.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
            aria-label={t("Close")}
            title={t("Close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-5">
          {error && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              {error}
            </div>
          )}

          <section className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-4">
              <Avatar size="xl" initials={initials(profile.name)} src={profile.avatarUrl} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={isExpert ? "primary" : "default"}>{t(roleLabel(profile.role))}</Badge>
                  {"availabilityStatus" in publicProfile && (
                    <Badge variant={publicProfile.availabilityStatus === "online" ? "success" : "default"}>
                      {t(availabilityLabel(publicProfile.availabilityStatus))}
                    </Badge>
                  )}
                  <Badge variant="default">#{profile.rank}</Badge>
                </div>
                {publicProfile.bio ? (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                    {publicProfile.bio}
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-neutral-500">{t("No bio listed.")}</p>
                )}
              </div>
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                {t("Loading profile...")}
              </div>
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <ProfileStat icon={<Zap className="h-4 w-4" />} label={t("Points")} value={(profile.points || 0).toLocaleString()} />
            <ProfileStat icon={<Award className="h-4 w-4" />} label={t("Badges")} value={`${profile.badges?.length || 0}`} />
            <ProfileStat
              icon={<Star className="h-4 w-4" />}
              label={isExpert ? t("Rating") : t("Role")}
              value={isExpert ? publicProfile.expertRatingAverage?.toFixed(1) || t("New") : t("Learner")}
            />
          </section>

          <section className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <div className="space-y-5">
              <InfoPanel title={t("Expertise")}>
                {(profile.expertise || []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.expertise.map((item) => (
                      <Badge key={`${item.subject}-${item.proficiency}`} variant="primary">
                        {item.subject} ({item.proficiency})
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">{t("No expertise areas listed.")}</p>
                )}
              </InfoPanel>

              <InfoPanel title={t("Skills")}>
                {(profile.skillTags || []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.skillTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                      >
                        <Tag className="h-3 w-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">{t("No skills listed.")}</p>
                )}
              </InfoPanel>
            </div>

            <InfoPanel title={t("Details")}>
              <div className="space-y-4 text-sm">
                <DetailLine icon={<BriefcaseBusiness className="h-4 w-4" />} label={t("Field")} value={publicProfile.primaryTechnicalField || t("No technical field listed")} />
                <DetailLine icon={<Clock className="h-4 w-4" />} label={t("Experience")} value={publicProfile.yearsOfExperience || t("No experience listed")} />
                <DetailLine icon={<CalendarDays className="h-4 w-4" />} label={t("Joined")} value={joinedLabel(profile.createdAt)} />
                {publicProfile.roleOrStatus && (
                  <DetailLine icon={<Award className="h-4 w-4" />} label={t("Status")} value={publicProfile.roleOrStatus} />
                )}
                {isExpert && (
                  <DetailLine icon={<Star className="h-4 w-4" />} label={t("Reviews")} value={`${publicProfile.expertReviewCount || 0}`} />
                )}
              </div>
            </InfoPanel>
          </section>
        </div>
      </div>
    </div>
  );
}

function ProfileStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <span className="text-primary-600 dark:text-primary-400">{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-xl font-bold text-neutral-950 dark:text-white">{value}</p>
    </div>
  );
}

function InfoPanel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <h3 className="mb-3 text-sm font-bold uppercase text-neutral-700 dark:text-neutral-300">{title}</h3>
      {children}
    </div>
  );
}

function DetailLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-neutral-400">{icon}</span>
      <div>
        <p className="text-xs font-semibold uppercase text-neutral-500">{label}</p>
        <p className="mt-0.5 text-neutral-800 dark:text-neutral-200">{value}</p>
      </div>
    </div>
  );
}
