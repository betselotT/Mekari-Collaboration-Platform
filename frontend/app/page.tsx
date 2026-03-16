"use client";

import Link from "next/link";
import { ThemeToggle } from "../components/theme/ThemeToggle";
import { Button } from "../components/ui/Button";
import { Zap, Users, MessageSquare, Lightbulb, Award, Code } from "lucide-react";

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
            <Button variant="secondary" size="lg">
              View Solutions
            </Button>
          </div>

          {/* Placeholder for illustration */}
          <div className="mt-16 rounded-2xl border border-neutral-200 bg-gradient-to-br from-primary-50 to-purple-50 p-12 dark:border-neutral-700 dark:from-neutral-800 dark:to-neutral-700">
            <div className="aspect-video bg-gradient-to-r from-primary-200 to-purple-200 rounded-lg dark:from-neutral-700 dark:to-neutral-600" />
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
            © 2024 Mekari Inc. All rights reserved.
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

