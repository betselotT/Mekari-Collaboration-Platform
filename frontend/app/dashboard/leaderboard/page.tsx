// Represents leaderboard participant data returned from the gamification API
"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { Card } from "../../../components/ui/Card";
import { Avatar } from "../../../components/ui/Avatar";
import { Badge } from "../../../components/ui/Badge";
import { Star, Zap } from "lucide-react";
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
export default function LeaderboardPage() {
  const { t } = useLanguage();
  const [learners, setLearners] = useState<LeaderboardUser[]>([]);
  const [experts, setExperts] = useState<LeaderboardUser[]>([]);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("experts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
            <LeaderboardSection title={t("Expert Leaderboard")} description={t("Top mentors by earned points.")} users={experts} />
          ) : (
            <LeaderboardSection title={t("Learner Leaderboard")} description={t("Top learners by earned points.")} users={learners} />
          )}
        </div>
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
}: {
  title: string;
  description: string;
  users: LeaderboardUser[];
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
                className={`relative ${
                  user.rank === 1
                    ? "border-primary-500 dark:border-primary-400 ring-2 ring-primary-500 ring-opacity-20"
                    : ""
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
                    <tr key={user._id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
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
