"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageToggle } from "@/components/i18n/LanguageToggle";
import { LoginForm } from "@/components/auth/LoginForm";
import { useLanguage } from "@/lib/i18n";
import { ContourField } from "@/components/visual/ContourField";

export default function LoginPage() {
  const { t } = useLanguage();

  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-white dark:bg-neutral-950">
      <div className="absolute inset-0 -z-30 bg-[radial-gradient(circle_at_15%_20%,rgba(139,92,246,0.18),transparent_28%),radial-gradient(circle_at_85%_12%,rgba(59,130,246,0.12),transparent_24%),linear-gradient(135deg,#ffffff_0%,#faf7ff_54%,#f8fbff_100%)] dark:bg-[radial-gradient(circle_at_15%_20%,rgba(124,58,237,0.24),transparent_27%),radial-gradient(circle_at_82%_25%,rgba(59,130,246,0.16),transparent_22%),linear-gradient(135deg,#050507_0%,#0a0712_52%,#030306_100%)]" />
      <div className="absolute inset-0 -z-20 opacity-50 [background-image:linear-gradient(rgba(109,40,217,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(109,40,217,.06)_1px,transparent_1px)] [background-size:52px_52px] dark:opacity-25 dark:[background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)]" />
      <ContourField className="pointer-events-none absolute -right-36 top-28 -z-10 h-[370px] w-[620px] rotate-[-8deg] opacity-50 dark:opacity-80" />
      <ContourField className="pointer-events-none absolute -bottom-24 -left-36 -z-10 h-[300px] w-[500px] rotate-[165deg] opacity-35 dark:opacity-55" />
      {/* Navigation */}
      <nav className="border-b border-neutral-200/80 bg-white/80 px-6 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/75">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-white font-bold">
              M
            </div>
            <span className="text-xl font-bold text-neutral-900 dark:text-white">Mekari</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>
      </nav>

      {/* Login Form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg rounded-3xl border border-primary-100 bg-white/85 p-8 shadow-2xl shadow-primary-100/60 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/75 dark:shadow-primary-950/30">
          <h1 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">{t("auth.welcomeBack")}</h1>
          <p className="mb-8 text-neutral-600 dark:text-neutral-400">
            {t("auth.accessCommunity")}
          </p>

          <LoginForm />

          <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
            {t("auth.noAccount")}{" "}
            <Link href="/register" className="font-semibold text-primary-600 transition-colors hover:text-primary-700 hover:underline dark:text-primary-400">
              {t("auth.signUp")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
