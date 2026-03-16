"use client";

import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { ExpertCard } from "../../../components/features/ExpertCard";
import { Button } from "../../../components/ui/Button";
import { Users } from "lucide-react";
import { useState } from "react";

export default function ExpertsPage() {
  const [selectedFilter, setSelectedFilter] = useState("All Subjects");

  const filters = [
    "All Subjects",
    "Product Management",
    "Software Engineering",
    "UX Design",
    "Data Science",
    "Marketing",
    "Finance",
  ];

  const experts = [
    {
      name: "Aditya Wijaya",
      title: "Senior Product Manager at GoTo",
      company: "GoTo",
      rating: 4.9,
      skills: ["STRATEGY", "ROADMAP", "GROWTH"],
      status: "available" as const,
    },
    {
      name: "Siti Aminah",
      title: "Tech Lead at Traveloka",
      company: "Traveloka",
      rating: 5.0,
      skills: ["REACT", "NODE.JS", "SYSTEM DESIGN"],
      status: "available_in_2h" as const,
    },
    {
      name: "Budi Santoso",
      title: "Marketing Director at Shopee",
      company: "Shopee",
      rating: 4.8,
      skills: ["BRANDING", "SEO", "SEM"],
      status: "away" as const,
    },
    {
      name: "Dewi Lestari",
      title: "Data Architect at Bukalapak",
      company: "Bukalapak",
      rating: 4.9,
      skills: ["BIG DATA", "PYTHON", "ML"],
      status: "available" as const,
    },
    {
      name: "Kevin Sanjaya",
      title: "Lead UX Designer at Grab",
      company: "Grab",
      rating: 4.7,
      skills: ["USER RESEARCH", "FIGMA", "UX WRITING"],
      status: "available" as const,
    },
    {
      name: "Lina Marlina",
      title: "Fintech Strategy at Bank Mandiri",
      company: "Bank Mandiri",
      rating: 4.9,
      skills: ["BANKING", "COMPLIANCE", "CRYPTO"],
      status: "available_in_2h" as const,
    },
  ];

  return (
    <DashboardLayout title="Expert Network" searchPlaceholder="Search experts by name or skills...">
      {/* Header */}
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">Meet Our Experts</h2>
        <p className="text-neutral-600 dark:text-neutral-400">
          Connect with industry leaders for personalized mentorship and strategic advice.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="mb-8 flex flex-wrap gap-2 overflow-x-auto pb-2">
        {filters.map((filter) => (
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

      {/* Experts grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {experts.map((expert) => (
          <ExpertCard key={expert.name} {...expert} />
        ))}
      </div>
    </DashboardLayout>
  );
}
