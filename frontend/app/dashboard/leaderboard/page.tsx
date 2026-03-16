"use client";

import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { Card } from "../../../components/ui/Card";
import { Avatar } from "../../../components/ui/Avatar";
import { Badge } from "../../../components/ui/Badge";
import { Star, Trophy, Zap } from "lucide-react";
import { useState } from "react";

export default function LeaderboardPage() {
  const [timePeriod, setTimePeriod] = useState<"weekly" | "monthly" | "all">("weekly");

  const topContributors = [
    {
      rank: 1,
      name: "Jordan Smith",
      expertise: "Full-Stack Architecture",
      points: 3120,
      badge: null,
      joinedDate: "Joined Jan 2024",
      highlighted: true,
    },
    {
      rank: 2,
      name: "Sarah Chen",
      expertise: "UI/UX Strategy",
      points: 2450,
      badge: null,
      joinedDate: "Joined Mar 2024",
    },
    {
      rank: 3,
      name: "Liam Wright",
      expertise: "Cloud Systems",
      points: 1890,
      badge: null,
      joinedDate: "Joined Jan 2024",
    },
  ];

  const allContributors = [
    {
      rank: 4,
      name: "Maria Lopez",
      expertise: "Product Management",
      joinedDate: "Joined Mar 2024",
      points: 1640,
      badge: "EXPERT CONTRIBUTOR",
    },
    {
      rank: 5,
      name: "David Kim",
      expertise: "Data Analytics",
      joinedDate: "Joined Jan 2024",
      points: 1525,
      badge: null,
    },
    {
      rank: 42,
      name: "Alex Rivera (You)",
      expertise: "Ranked up! +12 this week",
      joinedDate: "Pro Account",
      points: 840,
      badge: "EXPERT CONTRIBUTOR",
    },
    {
      rank: 43,
      name: "Emily Watson",
      expertise: "Backend Dev",
      joinedDate: "Joined Feb 2024",
      points: 812,
      badge: null,
    },
  ];

  return (
    <DashboardLayout title="Leaderboard">
      {/* Header */}
      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold text-neutral-900 dark:text-white">Contributor Leaderboard</h2>
        <p className="text-neutral-600 dark:text-neutral-400">
          Celebrating the individuals who shape our knowledge base and empower teams to succeed.
        </p>
      </div>

      {/* Top 3 Contributors */}
      <div className="mb-8 grid gap-6 md:grid-cols-3">
        {topContributors.map((contributor) => (
          <Card
            key={contributor.rank}
            className={`relative ${
              contributor.highlighted
                ? "border-primary-500 dark:border-primary-400 ring-2 ring-primary-500 ring-opacity-20"
                : ""
            }`}
          >
            {/* Rank Badge */}
            <div className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white font-bold shadow-lg">
              {contributor.rank === 1 ? "🥇" : contributor.rank === 2 ? "🥈" : "🥉"}
            </div>

            <div className="text-center">
              <Avatar size="xl" initials={contributor.name.split(" ").map((n) => n[0]).join("")} />
              <h3 className="mt-4 text-lg font-bold text-neutral-900 dark:text-white">
                {contributor.name}
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{contributor.expertise}</p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <Zap className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {contributor.points.toLocaleString()} pts
                </span>
              </div>
              <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-500">{contributor.joinedDate}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="mb-8 flex gap-2">
        {(["weekly", "monthly", "all"] as const).map((period) => (
          <button
            key={period}
            onClick={() => setTimePeriod(period)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors capitalize ${
              timePeriod === period
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            {period}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800">
            All Expertise
          </button>
          <button className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800">
            Filter
          </button>
        </div>
      </div>

      {/* Leaderboard Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-neutral-200 dark:border-neutral-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-400">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-400">
                  Contributor
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-400">
                  Expertise
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-400">
                  Badges
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-400">
                  Points
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {allContributors.map((contributor) => (
                <tr
                  key={contributor.rank}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <td className="px-6 py-4 text-sm font-bold text-neutral-900 dark:text-white">
                    {contributor.rank}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        size="md"
                        initials={contributor.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      />
                      <div>
                        <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                          {contributor.name}
                        </p>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400">
                          {contributor.joinedDate}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                    {contributor.expertise}
                  </td>
                  <td className="px-6 py-4">
                    {contributor.badge ? (
                      <Badge variant="primary">{contributor.badge}</Badge>
                    ) : (
                      <div className="flex gap-1">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <Star className="h-4 w-4 text-neutral-300 dark:text-neutral-600" />
                        <Star className="h-4 w-4 text-neutral-300 dark:text-neutral-600" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-primary-600 dark:text-primary-400">
                    {contributor.points.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-neutral-200 px-6 py-4 dark:border-neutral-700">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Showing 1 to 7 of 152 contributors</p>
          <div className="flex items-center gap-2">
            <button className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-800">
              ←
            </button>
            {[1, 2, 3].map((page) => (
              <button
                key={page}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  page === 1
                    ? "bg-primary-600 text-white"
                    : "border border-neutral-300 hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
                }`}
              >
                {page}
              </button>
            ))}
            <button className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-800">
              →
            </button>
          </div>
        </div>
      </Card>
    </DashboardLayout>
  );
}
