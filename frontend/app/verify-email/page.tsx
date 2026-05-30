"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "../../lib/api";
import { useLanguage } from "../../lib/i18n";

const inputClass =
  "w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-primary-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyShell />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  return <VerifyShell initialEmail={searchParams.get("email") || ""} />;
}

function VerifyShell({ initialEmail = "" }: { initialEmail?: string }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(
    initialEmail ? t("We sent a 6-digit OTP code to your email.") : null
  );
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await apiClient.post("/api/auth/verify-email", { email, otp });
      setVerified(true);
      setMessage(res.data.message || t("Email verified. You can sign in now."));
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t("Could not verify OTP code"));
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (!email) {
      setError(t("Enter your email address first."));
      return;
    }

    setResending(true);
    setError(null);
    setMessage(null);

    try {
      const res = await apiClient.post("/api/auth/resend-verification", { email });
      setMessage(res.data.message || t("A new OTP code has been sent if the account needs it."));
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t("Could not resend OTP code"));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 py-12 dark:bg-neutral-950">
      <div className="w-full max-w-md rounded border border-neutral-200 bg-white p-8 dark:border-neutral-700 dark:bg-neutral-900">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">{t("Verify Email")}</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {t("Enter the 6-digit code sent to your inbox.")}
        </p>

        {message && (
          <p className="mt-4 rounded bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
            {error}
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4 text-sm">
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">{t("auth.email")}</span>
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">{t("OTP code")}</span>
            <input
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              className={`${inputClass} text-center text-lg font-semibold tracking-[0.3em]`}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading || verified}
            className="w-full rounded bg-primary-500 px-3 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
          >
            {loading ? t("Verifying...") : verified ? t("Verified") : t("Verify email")}
          </button>
          <button
            type="button"
            disabled={resending || verified}
            onClick={onResend}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            {resending ? t("Sending...") : t("Resend OTP")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
          {t("Ready to continue?")}{" "}
          <Link href="/login" className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
            {t("auth.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
