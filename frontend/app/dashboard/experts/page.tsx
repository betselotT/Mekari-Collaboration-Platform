"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { ExpertCard } from "../../../components/features/ExpertCard";
import { Users } from "lucide-react";
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
}

function mapStatus(
  s: DBExpert["availabilityStatus"]
): "available" | "available_in_2h" | "away" {
  if (s === "online") return "available";
  if (s === "busy" || s === "in_session") return "available_in_2h";
  return "away";
}

function mapRating(points: number): number {
  // 0 pts → 3.0,  500 pts → 4.5,  1000+ pts → 5.0
  return Math.min(5, 3 + (Math.min(points, 1000) / 1000) * 2);
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

export default function ExpertsPage() {
  const router = useRouter();
  const [experts, setExperts] = useState<DBExpert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState("All");

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

  function handleConsult(expert: DBExpert) {
    // Pre-fill the match page with this expert's top subject and tags
    const subject = expert.expertise[0]?.subject || "";
    const tags = buildSkills(expert).join(",");
    router.push(
      `/dashboard/match?subject=${encodeURIComponent(subject)}&tags=${encodeURIComponent(tags)}`
    );
  }

  async function handleDm(expert: DBExpert) {
    try {
      const res = await apiClient.post<{ conversation: { _id: string } }>(
        "/api/dms/conversations",
        { expertId: expert._id }
      );
      router.push(`/dashboard/messages?conversation=${res.data.conversation._id}`);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || "Failed to start direct message");
    }
  }

  return (
    <DashboardLayout title="Expert Network" searchPlaceholder="Search experts by name or skills...">
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">
          Meet Our Experts
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400">
          Connect with experienced peers for mentorship and problem-solving.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="mb-8 flex flex-wrap gap-2 overflow-x-auto pb-2">
        {filterOptions.map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              selectedFilter === filter
                ? "bg-primary-600 text-white"
                : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          {experts.length === 0
            ? "No experts found."
            : `No experts match "${selectedFilter}".`}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((expert) => (
            <ExpertCard
              key={expert._id}
              name={expert.name}
              title={buildTitle(expert)}
              company=""
              rating={parseFloat(mapRating(expert.points).toFixed(1))}
              image={expert.avatarUrl}
              skills={buildSkills(expert)}
              status={mapStatus(expert.availabilityStatus)}
              onConsult={() => handleConsult(expert)}
              onDm={() => handleDm(expert)}
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
