"use client";

import Link from "next/link";
import { ThemeToggle } from "../components/theme/ThemeToggle";
import { Button } from "../components/ui/Button";
import {
  Zap,
  Users,
  MessageSquare,
  Lightbulb,
  Award,
  Code,
  CheckCircle2,
  Search,
  Video,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-white font-bold">
              M
            </div>
            <span className="text-xl font-bold text-neutral-900 dark:text-white">Mekari</span>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#solutions" className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
              Solutions
            </a>
            <a href="#community" className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
              Community
            </a>
            <a href="#pricing" className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="secondary" size="sm">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-6 text-5xl font-bold leading-tight text-neutral-900 dark:text-white">
            Ask.<br />
            Collaborate.<br />
            <span className="text-primary-600">Grow.</span>
          </h1>
          <p className="mb-8 text-lg text-neutral-600 dark:text-neutral-300">
            Real-time technical collaboration with peer mentorship and expert support. Elevate your development workflow with the power of community.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link href="/register">
              <Button variant="primary" size="lg">
                Get Started Free
              </Button>
            </Link>
            <Link href="/threads">
              <Button variant="secondary" size="lg">
                Browse Threads
              </Button>
            </Link>
          </div>

          <div className="mt-16 overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left shadow-xl shadow-primary-100/50 dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-none">
            <div className="grid min-h-[360px] md:grid-cols-[1.05fr_0.95fr]">
              <div className="flex flex-col justify-between gap-6 bg-gradient-to-br from-primary-600 via-violet-600 to-indigo-700 p-6 text-white sm:p-8">
                <div>
                  <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                    <Zap className="h-3.5 w-3.5" />
                    Live collaboration preview
                  </div>
                  <h2 className="text-2xl font-bold leading-tight sm:text-3xl">
                    From stuck to solved in one shared workspace.
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-violet-100">
                    Post a technical blocker, get smart tags, match with available mentors, and keep the solution searchable for the next learner.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {heroStats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="rounded-lg bg-white/12 p-3 ring-1 ring-white/15 backdrop-blur">
                        <Icon className="mb-2 h-4 w-4 text-violet-100" />
                        <p className="text-lg font-bold">{stat.value}</p>
                        <p className="mt-1 text-xs text-violet-100">{stat.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-neutral-50 p-5 dark:bg-neutral-950 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                      Active thread
                    </p>
                    <h3 className="mt-1 text-base font-bold text-neutral-950 dark:text-white">
                      MongoDB query timing out
                    </h3>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    Mentor online
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-white">
                      <Search className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                      AI tagged the issue
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["mongodb", "indexing", "node-api"].map((tag) => (
                        <span key={tag} className="rounded bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-950 dark:text-primary-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-white">
                      <Users className="h-4 w-4 text-amber-500" />
                      Matched helpers
                    </div>
                    <div className="space-y-2">
                      {["Edom - Database design", "Meklit - Backend APIs"].map((mentor, index) => (
                        <div key={mentor} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800">
                          <span className="text-sm text-neutral-700 dark:text-neutral-200">{mentor}</span>
                          <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                            {index === 0 ? "96%" : "88%"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-white">
                        <Video className="h-4 w-4 text-sky-500" />
                        Live session
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Ready for voice and whiteboard handoff.</p>
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-white">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        Knowledge saved
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Solved answers become searchable examples.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Mekari Section */}
      <section id="solutions" className="bg-neutral-50 py-20 px-6 dark:bg-neutral-900">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-neutral-900 dark:text-white">Why Mekari?</h2>
            <p className="text-lg text-neutral-600 dark:text-neutral-400">
              Empowering developers through real-time support.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800"
                >
                  <div className="mb-4 inline-flex rounded-lg bg-primary-100 p-3 dark:bg-primary-900">
                    <Icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-neutral-900 dark:text-white">{feature.title}</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-neutral-200 px-6 py-20 dark:border-neutral-700">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-6 text-3xl font-bold text-neutral-900 dark:text-white">Welcome Back</h2>
          <p className="mb-8 text-neutral-600 dark:text-neutral-400">
            Access your technical community
          </p>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-8 dark:border-neutral-700 dark:bg-neutral-800">
            <div className="mb-6">
              <input
                type="email"
                placeholder="name@company.com"
                className="input mb-4"
              />
              <input
                type="password"
                placeholder="••••••••"
                className="input"
              />
            </div>

            <Link href="/dashboard/threads" className="block mb-4">
              <Button variant="primary" size="lg" className="w-full">
                Sign in
              </Button>
            </Link>

            <div className="relative mb-6 flex items-center gap-4">
              <div className="flex-1 border-t border-neutral-200 dark:border-neutral-700" />
              <span className="text-xs text-neutral-500">OR</span>
              <div className="flex-1 border-t border-neutral-200 dark:border-neutral-700" />
            </div>

            <Button variant="secondary" size="lg" className="w-full">
              Continue with Google
            </Button>
          </div>

          <p className="mt-6 text-xs text-neutral-600 dark:text-neutral-400">
            &copy; 2026 Mekari Inc. All rights reserved.
          </p>
        </div>
      </section>
    </div>
  );
}

const features = [
  {
    icon: MessageSquare,
    title: "Subject Channels",
    description: "Dedicated spaces for every tech stack and library.",
  },
  {
    icon: Users,
    title: "Expert Matching",
    description: "Connect with the right mentor instantly for your issue.",
  },
  {
    icon: Code,
    title: "Live Sessions",
    description: "Real-time pair coding and visual debugging together.",
  },
  {
    icon: Lightbulb,
    title: "AI Assistance",
    description: "Smart suggestions and automated debugging help.",
  },
  {
    icon: Award,
    title: "Gamification",
    description: "Earn rewards and reputation for contributing.",
  },
  {
    icon: Zap,
    title: "Real-time Collaboration",
    description: "Instant support from the community when you need it.",
  },
];

const heroStats = [
  {
    icon: MessageSquare,
    value: "2s",
    label: "real-time replies",
  },
  {
    icon: Users,
    value: "96%",
    label: "mentor match",
  },
  {
    icon: Award,
    value: "+20",
    label: "solution points",
  },
];

