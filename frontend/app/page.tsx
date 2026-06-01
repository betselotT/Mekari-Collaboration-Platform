"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ThemeToggle } from "../components/theme/ThemeToggle";
import { LanguageToggle } from "../components/i18n/LanguageToggle";
import { GoogleAuthButton } from "../components/auth/GoogleAuthButton";
import { GithubAuthButton } from "../components/auth/GithubAuthButton";
import { Button } from "../components/ui/Button";
import { apiClient } from "../lib/api";
import { useLanguage } from "../lib/i18n";
import { ContourField } from "../components/visual/ContourField";
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
  ArrowRight,
} from "lucide-react";

type LandingPreview = {
  threadTitle: string;
  subject: string;
  tags: string[];
  helpers: Array<{
    name: string;
    expertise: string;
    availabilityStatus: string;
    points: number;
  }>;
  hasLiveSession: boolean;
  connectionPreferences: string[];
  stats: {
    activeMatchRequests: number;
    approvedExperts: number;
    solutionPoints: number;
  };
};

export default function LandingPage() {
  const { t } = useLanguage();
  const [authError, setAuthError] = useState<string | null>(null);
  const [landingEmail, setLandingEmail] = useState("");
  const [landingPassword, setLandingPassword] = useState("");
  const [landingLoading, setLandingLoading] = useState(false);
  const [landingPreview, setLandingPreview] = useState<LandingPreview | null>(null);

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get<{ preview: LandingPreview }>("/api/matching/public/landing-preview")
      .then((res) => {
        if (isMounted) setLandingPreview(res.data.preview);
      })
      .catch(() => {
        if (isMounted) setLandingPreview(null);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  function getAuthErrorMessage(err: any, fallback: string) {
    return err.response?.data?.message || err.response?.data?.error?.message || fallback;
  }

  async function onLandingSignIn(e: FormEvent) {
    e.preventDefault();
    setLandingLoading(true);
    setAuthError(null);

    try {
      const res = await apiClient.post("/api/auth/login", {
        email: landingEmail,
        password: landingPassword,
      });
      localStorage.setItem("mekari_token", res.data.token);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setAuthError(getAuthErrorMessage(err, t("auth.loginFailed")));
    } finally {
      setLandingLoading(false);
    }
  }

  async function onGoogleSignIn(credential: string) {
    setAuthError(null);
    try {
      const res = await apiClient.post("/api/auth/google", {
        credential,
      });
      localStorage.setItem("mekari_token", res.data.token);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setAuthError(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          t("auth.googleLoginFailed")
      );
    }
  }

  const heroStats = [
    {
      icon: MessageSquare,
      value: landingPreview ? String(landingPreview.stats.activeMatchRequests) : "-",
      label: "active match requests",
    },
    {
      icon: Users,
      value: landingPreview ? String(landingPreview.stats.approvedExperts) : "-",
      label: "approved experts",
    },
    {
      icon: Award,
      value: landingPreview ? String(landingPreview.stats.solutionPoints) : "-",
      label: "solution points",
    },
  ];
  const connectionLabel = landingPreview?.hasLiveSession
    ? "Live session link saved"
    : landingPreview?.connectionPreferences.length
      ? landingPreview.connectionPreferences.map(formatConnectionPreference).join(", ")
      : "No live session yet";

  return (
    <div className="min-h-screen overflow-hidden bg-white dark:bg-neutral-950">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-neutral-200/80 bg-white/85 text-neutral-950 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/85 dark:text-white dark:shadow-lg dark:shadow-black/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-violet-700 text-white font-bold shadow-lg shadow-primary-950/50 ring-1 ring-white/20">
              M
            </div>
            <div>
              <span className="block text-xl font-bold tracking-tight">Mekari</span>
            </div>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#community" className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-600 transition-colors hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white">
              {t("landing.community")}
            </a>
            <a href="#solutions" className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-600 transition-colors hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white">
              {t("landing.solutions")}
            </a>
            {/* <a href="#pricing" className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
              {t("landing.pricing")}
            </a> */}
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <LanguageToggle />
            <Link href="/login">
              <Button variant="primary" size="sm" className="rounded-full px-5 shadow-lg shadow-primary-200/60 hover:scale-105 hover:shadow-primary-300/70 dark:shadow-primary-950/40 dark:hover:shadow-primary-900/60">
                {t("auth.signIn")}
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative isolate overflow-hidden bg-white px-6 pb-20 pt-32 dark:bg-neutral-950">
        <div className="absolute inset-0 -z-30 bg-[radial-gradient(circle_at_15%_20%,rgba(139,92,246,0.18),transparent_28%),radial-gradient(circle_at_85%_12%,rgba(59,130,246,0.12),transparent_24%),linear-gradient(135deg,#ffffff_0%,#faf7ff_54%,#f8fbff_100%)] dark:bg-[radial-gradient(circle_at_15%_20%,rgba(124,58,237,0.24),transparent_27%),radial-gradient(circle_at_82%_25%,rgba(59,130,246,0.16),transparent_22%),linear-gradient(135deg,#050507_0%,#0a0712_52%,#030306_100%)]" />
        <div className="absolute inset-0 -z-20 opacity-50 [background-image:linear-gradient(rgba(109,40,217,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(109,40,217,.06)_1px,transparent_1px)] [background-size:52px_52px] dark:opacity-30 dark:[background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)]" />
        <div className="mx-auto max-w-7xl">
          <div className="grid min-h-[560px] items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="relative z-10">
              <h1 className="text-6xl font-black leading-[0.94] tracking-[-0.07em] text-neutral-950 dark:text-white sm:text-7xl lg:text-[7rem]">
                {t("landing.ask")}<br />
                {t("landing.collaborate")}<br />
                <span className="bg-gradient-to-r from-primary-600 via-violet-500 to-sky-500 bg-clip-text text-transparent dark:from-primary-300 dark:via-violet-400 dark:to-sky-300">
                  {t("landing.grow")}
                </span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-neutral-600 dark:text-neutral-300 sm:text-lg">
                {t("landing.heroCopy")}
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link href="/register">
                  <Button variant="primary" size="lg" className="w-full rounded-full px-7 shadow-xl shadow-primary-200/70 transition-all duration-300 hover:-translate-y-1 hover:scale-[1.03] hover:shadow-2xl hover:shadow-primary-300/70 dark:shadow-primary-950/70 dark:hover:shadow-primary-900/70 sm:w-auto">
                    {t("landing.getStarted")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/threads">
                  <Button variant="outline" size="lg" className="w-full rounded-full border-primary-200 bg-white/70 px-7 text-neutral-900 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:scale-[1.03] hover:border-primary-400 hover:bg-white hover:shadow-xl hover:shadow-primary-100 dark:border-white/25 dark:bg-white/5 dark:text-white dark:hover:border-primary-400 dark:hover:bg-white/10 dark:hover:shadow-primary-950/60 sm:w-auto">
                    {t("landing.browseThreads")}
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative min-h-[420px] lg:min-h-[540px]">
              <ContourField className="absolute -right-24 top-0 h-[370px] w-[620px] rotate-[-5deg] opacity-75 dark:opacity-95" />
              <ContourField className="absolute -bottom-8 right-2 h-[300px] w-[500px] rotate-[167deg] opacity-55 dark:opacity-75" />
              <div className="absolute right-4 top-12 h-24 w-24 rounded-full border border-primary-400/50 bg-primary-500/10 shadow-[0_0_80px_rgba(139,92,246,.3)] backdrop-blur">
                <div className="absolute inset-4 rounded-full border border-sky-400/60" />
                <div className="absolute inset-9 rounded-full bg-primary-500 shadow-[0_0_30px_rgba(139,92,246,.75)]" />
              </div>
            </div>
          </div>

          <div id="community" className="relative mt-8 scroll-mt-24 overflow-hidden rounded-3xl border border-primary-100 bg-white/80 text-left shadow-2xl shadow-primary-100/60 backdrop-blur-xl transition-transform duration-500 hover:-translate-y-1 dark:border-primary-700/50 dark:bg-neutral-950/85 dark:shadow-primary-950/30">
            <div className="grid min-h-[360px] md:grid-cols-[1.05fr_0.95fr]">
              <div className="relative flex flex-col justify-between gap-6 overflow-hidden bg-gradient-to-br from-primary-600 via-violet-600 to-indigo-950 p-6 text-white sm:p-8">
                <ContourField className="absolute -bottom-28 -right-32 h-80 w-[520px] rotate-[155deg] opacity-25" />
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

              <div className="bg-white/85 p-5 dark:bg-neutral-950/90 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                      Active thread
                    </p>
                    <h3 className="mt-1 text-base font-bold text-neutral-950 dark:text-white">
                      {landingPreview?.threadTitle || "Loading project activity..."}
                    </h3>
                  </div>
                  {landingPreview?.helpers[0]?.availabilityStatus && (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      Mentor {landingPreview.helpers[0].availabilityStatus}
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-primary-100 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-white">
                      <Search className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                      Saved tags
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(landingPreview?.tags || []).map((tag) => (
                        <span key={tag} className="rounded-md border border-primary-100 bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700 dark:border-primary-600/60 dark:bg-primary-900/80 dark:text-primary-100">
                          {tag}
                        </span>
                      ))}
                      {landingPreview && landingPreview.tags.length === 0 && (
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">{t("No tags saved yet")}</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-primary-100 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-white">
                      <Users className="h-4 w-4 text-amber-500" />
                      Matched helpers
                    </div>
                    <div className="space-y-2">
                      {(landingPreview?.helpers || []).map((mentor) => (
                        <div key={mentor.name} className="flex items-center justify-between rounded-lg bg-primary-50/70 px-3 py-2 dark:bg-white/5">
                          <span className="text-sm text-neutral-700 dark:text-neutral-200">{mentor.name} - {mentor.expertise}</span>
                          <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                            {mentor.points} pts
                          </span>
                        </div>
                      ))}
                      {landingPreview && landingPreview.helpers.length === 0 && (
                        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                          No matched helpers saved yet
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-primary-100 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-white">
                        <Video className="h-4 w-4 text-sky-500" />
                        Connection
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {connectionLabel}
                      </p>
                    </div>
                    <div className="rounded-xl border border-primary-100 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-white">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        Project subject
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {landingPreview?.subject ? `Subject: ${landingPreview.subject}` : "No subject loaded"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Mekari Section */}
      <section id="solutions" className="relative overflow-hidden bg-gradient-to-b from-white to-primary-50/50 px-6 py-24 dark:from-neutral-950 dark:to-neutral-900">
        <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(109,40,217,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(109,40,217,.05)_1px,transparent_1px)] [background-size:52px_52px] dark:opacity-20 dark:[background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)]" />
        <div className="absolute -right-40 top-16 h-80 w-80 rounded-full bg-primary-200/30 blur-3xl dark:bg-primary-900/20" />
        <ContourField className="pointer-events-none absolute -left-36 bottom-0 h-72 w-[480px] rotate-[170deg] opacity-20 dark:opacity-35" />
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary-600 dark:text-primary-300">
              {t("landing.solutions")}
            </p>
            <h2 className="mb-4 text-4xl font-black tracking-tight text-neutral-900 dark:text-white">{t("Why Mekari?")}</h2>
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
                  className="group rounded-2xl border border-primary-100 bg-white/80 p-6 shadow-sm backdrop-blur transition-all hover:-translate-y-1 hover:border-primary-300 hover:shadow-xl hover:shadow-primary-100/70 dark:border-white/10 dark:bg-white/5 dark:hover:border-primary-700 dark:hover:shadow-primary-950/30"
                >
                  <div className="mb-4 inline-flex rounded-xl bg-primary-100 p-3 transition-transform group-hover:scale-110 dark:bg-primary-900">
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
      <section className="relative overflow-hidden border-t border-primary-100 bg-white px-6 py-24 dark:border-white/10 dark:bg-neutral-950">
        <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(109,40,217,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(109,40,217,.05)_1px,transparent_1px)] [background-size:52px_52px] dark:opacity-20 dark:[background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)]" />
        <div className="absolute left-1/2 top-8 h-56 w-96 -translate-x-1/2 rounded-full bg-primary-200/30 blur-3xl dark:bg-primary-900/20" />
        <ContourField className="pointer-events-none absolute -right-44 bottom-0 h-72 w-[480px] rotate-[-8deg] opacity-15 dark:opacity-30" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="mb-6 text-4xl font-black tracking-tight text-neutral-900 dark:text-white">{t("auth.welcomeBack")}</h2>
          <p className="mb-8 text-neutral-600 dark:text-neutral-400">
            {t("auth.accessCommunity")}
          </p>

          <form
            onSubmit={onLandingSignIn}
            className="relative rounded-3xl border border-primary-100 bg-white/85 p-8 shadow-2xl shadow-primary-100/60 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-primary-950/20"
          >
            <div className="mb-6">
              <input
                type="email"
                placeholder="name@company.com"
                className="input mb-4"
                value={landingEmail}
                onChange={(e) => setLandingEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="••••••••"
                className="input"
                value={landingPassword}
                onChange={(e) => setLandingPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="mb-4 w-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary-200 dark:hover:shadow-primary-950"
              disabled={landingLoading}
            >
              {landingLoading ? t("auth.signingIn") : t("auth.signIn")}
            </Button>

            <div className="relative mb-6 flex items-center gap-4">
              <div className="flex-1 border-t border-neutral-200 dark:border-neutral-700" />
              <span className="text-xs text-neutral-500">{t("OR")}</span>
              <div className="flex-1 border-t border-neutral-200 dark:border-neutral-700" />
            </div>

            {authError && (
              <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
                {authError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <GoogleAuthButton onCredential={onGoogleSignIn} onError={setAuthError} />
              <GithubAuthButton mode="login" />
            </div>
          </form>

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

function formatConnectionPreference(preference: string) {
  return preference.replace(/_/g, " ");
}

