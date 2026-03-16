"use client";

import { DashboardLayout } from "../../../../components/layout";
import { StatCard } from "../../../../components/features/StatCard";
import { ThreadCard } from "../../../../components/features/ThreadCard";
import { Button } from "../../../../components/ui/Button";
import { MessageSquare, Users, BookOpen, Plus } from "lucide-react";

export default function SoftwareEngineeringPage() {
  return (
    <DashboardLayout title="Software Engineering" searchPlaceholder="Search threads, experts...">
      {/* Title Section */}
      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold text-neutral-900 dark:text-white">Software Engineering</h2>
        <p className="text-neutral-600 dark:text-neutral-400">
          Subject Overview and Community Activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <StatCard
          icon={MessageSquare}
          label="Active Threads"
          value="1,248"
          change={12}
          description="this week"
        />
        <StatCard
          icon={Users}
          label="Experts Online"
          value="42"
          description="Currently providing guidance"
        />
        <StatCard
          icon={BookOpen}
          label="Resources"
          value="340"
          description="Documentation and tutorials"
        />
      </div>

      {/* Recent Threads Section */}
      <div className="mb-8">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Recent Threads</h3>
          <a href="#" className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
            View All
          </a>
        </div>

        <div className="space-y-4">
          <ThreadCard
            title="Microservices vs Monolith: Choosing the right architecture for a FinTech app?"
            category="ARCHITECTURE"
            description="We're starting a new project that needs to handle high transaction volumes. Should we go microservices from day one or start with a modular monolith?"
            author="Alex Rivera"
            timestamp="2h ago"
            replyCount={24}
            tags={["ARCHITECTURE", "SCALING"]}
          />
          <ThreadCard
            title="Best practices for implementing TDD in a fast-paced environment?"
            category="TESTING"
            description="Our team is struggling to keep up with delivery deadlines while maintaining high test coverage. Any tips on balancing speed and quality?"
            author="Jordan Smith"
            timestamp="5h ago"
            replyCount={12}
            tags={["TESTING", "AGILE"]}
          />
        </div>
      </div>

      {/* Featured Experts & About Section */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Featured Experts */}
        <div className="lg:col-span-2 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
          <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-neutral-900 dark:text-white">
            <Users className="h-5 w-5 text-primary-600" />
            Featured Experts
          </h3>

          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between border-b border-neutral-200 pb-4 last:border-b-0 dark:border-neutral-700">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600" />
                  <div>
                    <p className="font-semibold text-neutral-900 dark:text-white">Sarah Chen</p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">System Architect @ TechFlow</p>
                  </div>
                </div>
                <Button variant="primary" size="sm">
                  Consult
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* About Section */}
        <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
          <h3 className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">About this Subject</h3>
          <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            Software engineering is the systematic application of engineering approaches to the development of software. This section covers methodologies, tools, and best practices for building scalable systems.
          </p>
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-400">
            <BookOpen className="h-4 w-4" />
            34 Learning Modules
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
