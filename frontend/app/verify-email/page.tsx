"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "../../lib/api";
import { useLanguage } from "../../lib/i18n";
import { ContourField } from "../../components/visual/ContourField";

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
      window.location.href = `/login?verified=true&email=${encodeURIComponent(email)}`;
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
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-white px-6 py-12 dark:bg-neutral-950">
      <div className="absolute inset-0 -z-30 bg-[radial-gradient(circle_at_15%_20%,rgba(139,92,246,0.18),transparent_28%),radial-gradient(circle_at_85%_12%,rgba(59,130,246,0.12),transparent_24%),linear-gradient(135deg,#ffffff_0%,#faf7ff_54%,#f8fbff_100%)] dark:bg-[radial-gradient(circle_at_15%_20%,rgba(124,58,237,0.24),transparent_27%),radial-gradient(circle_at_82%_25%,rgba(59,130,246,0.16),transparent_22%),linear-gradient(135deg,#050507_0%,#0a0712_52%,#030306_100%)]" />
      <div className="absolute inset-0 -z-20 opacity-50 [background-image:linear-gradient(rgba(109,40,217,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(109,40,217,.06)_1px,transparent_1px)] [background-size:52px_52px] dark:opacity-25 dark:[background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)]" />
      <ContourField className="pointer-events-none absolute -right-36 top-20 -z-10 h-[370px] w-[620px] rotate-[-8deg] opacity-45 dark:opacity-75" />
      <ContourField className="pointer-events-none absolute -bottom-24 -left-36 -z-10 h-[300px] w-[500px] rotate-[165deg] opacity-30 dark:opacity-50" />
      <div className="w-full max-w-md rounded-3xl border border-primary-100 bg-white/90 p-8 shadow-2xl shadow-primary-100/60 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/80 dark:shadow-primary-950/30">
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
            className="w-full rounded-lg bg-primary-500 px-3 py-2 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-primary-600 hover:shadow-lg hover:shadow-primary-200 disabled:translate-y-0 disabled:opacity-60 dark:hover:shadow-primary-950"
          >
            {loading ? t("Verifying...") : verified ? t("Verified") : t("Verify email")}
          </button>
          <button
            type="button"
            disabled={resending || verified}
            onClick={onResend}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition-all hover:-translate-y-0.5 hover:bg-neutral-50 disabled:translate-y-0 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
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
