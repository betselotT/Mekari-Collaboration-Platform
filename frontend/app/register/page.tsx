"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageToggle } from "@/components/i18n/LanguageToggle";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { useLanguage } from "@/lib/i18n";

const APP_NAME = "Mekari";

const registerCardClassName =
  "w-full max-w-3xl rounded-lg border border-neutral-200 bg-white p-8 dark:border-neutral-700 dark:bg-neutral-800";

export default function RegisterPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-neutral-950">
      {/* Navigation */}
      <nav className="border-b border-neutral-200 bg-white px-6 py-4 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-white font-bold">
              M
            </div>

            <span className="text-xl font-bold text-neutral-900 dark:text-white">
              {APP_NAME}
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>
      </nav>

      {/* Registration Form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className={registerCardClassName}>
          <h1 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">
            {t("auth.createAccount")}
          </h1>

          <p className="mb-8 text-neutral-600 dark:text-neutral-400">
            {t("auth.joinCommunity")}
          </p>

          <RegisterForm />

          <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
            {t("auth.hasAccount")}{" "}

            <Link
              href="/login"
              className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400"
            >
              {t("auth.signIn")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
