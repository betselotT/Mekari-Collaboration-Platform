"use client";

import { DashboardLayout } from "../../../components/layout";
import { ThreadCard } from "../../../components/features/ThreadCard";
import { Button } from "../../../components/ui/Button";
import { MessageCircle, Plus } from "lucide-react";

export default function ThreadsPage() {
  const threads = [
    {
      title: "How to implement Redux? Best practices for 2024",
      category: "SOFTWARE ENGINEERING",
      description:
        "I'm building a large-scale React app and wondering about the current state of Redux vs Context API...",
      author: "Alex Rivera",
      timestamp: "10:30 AM",
      replyCount: 24,
      tags: ["ARCHITECTURE", "SCALING"],
    },
    {
      title: "Optimizing SQL Queries for large datasets",
      category: "DATA ENGINEERING",
      description:
        "We are seeing slow response times on our main analytics dashboard when filtering by date...",
      author: "Jordan Smith",
      timestamp: "3m ago",
      replyCount: 12,
      tags: ["TESTING", "AGILE"],
    },
    {
      title: "Microservices vs Monolith for new projects?",
      category: "SYSTEM DESIGN",
      description:
        "Starting a new fintech startup and debating the initial infrastructure architecture...",
      author: "Sarah Chen",
      timestamp: "1h ago",
      replyCount: 8,
      tags: ["ARCHITECTURE"],
    },
  ];

  return (
    <DashboardLayout title="Threads" searchPlaceholder="Search threads, experts...">
      {/* Header with filters */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary-600" />
          <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
            THREADS
          </span>
        </div>
        <Button variant="primary" size="md">
          <Plus className="h-4 w-4 mr-2" />
          New Thread
        </Button>
      </div>

      {/* Thread list */}
      <div className="space-y-4">
        {threads.map((thread, index) => (
          <ThreadCard
            key={index}
            title={thread.title}
            category={thread.category}
            description={thread.description}
            author={thread.author}
            timestamp={thread.timestamp}
            replyCount={thread.replyCount}
            tags={thread.tags}
          />
        ))}
      </div>
    </DashboardLayout>
  );
}
