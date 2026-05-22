"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Captcha } from "../auth/Captcha";
import { apiClient } from "../../lib/api";
import { usePublicConfig } from "../../lib/publicConfig";

type VerificationState = "checking" | "challenge" | "verified";

const verificationStorageKey = "mekari_security_verified";

function hasCaptchaSiteKey(siteKey: string) {
  return Boolean(siteKey && siteKey !== "your-recaptcha-site-key");
}

export function SecurityVerificationGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VerificationState>("checking");
  const [error, setError] = useState<string | null>(null);
  const { recaptchaSiteKey } = usePublicConfig();
  const captchaConfigured = hasCaptchaSiteKey(recaptchaSiteKey);

  const completeVerification = useCallback(() => {
    sessionStorage.setItem(verificationStorageKey, "true");
    setState("verified");
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem(verificationStorageKey) === "true") {
      setState("verified");
      return;
    }

    if (captchaConfigured) {
      setState("challenge");
      return;
    }

    const timer = window.setTimeout(completeVerification, 2200);
    return () => window.clearTimeout(timer);
  }, [captchaConfigured, completeVerification]);

  const handleCaptchaSuccess = useCallback(
    async (token: string | null) => {
      if (!token) return;

      setError(null);
      try {
        await apiClient.post("/api/security/verify-captcha", { captchaToken: token });
        window.setTimeout(completeVerification, 650);
      } catch (err: any) {
        setError(
          err.response?.data?.error?.message ||
            err.response?.data?.message ||
            "Security verification failed. Please refresh the page and try again."
        );
      }
    },
    [completeVerification]
  );

  const handleCaptchaError = useCallback(() => {
    setError("Security verification failed. Please refresh the page and try again.");
  }, []);

  if (state === "verified") {
    return <>{children}</>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-neutral-950 dark:bg-neutral-950 dark:text-white">
      <section className="w-full max-w-lg">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-white">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <span className="text-xl font-bold">mekari.app</span>
        </div>

        <div className="border-y border-neutral-200 py-10 dark:border-neutral-800">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-900">
            {state === "checking" ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary-600 dark:text-primary-400" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-primary-600 dark:text-primary-400" aria-hidden="true" />
            )}
          </div>

          <h1 className="text-2xl font-semibold">Performing security verification</h1>
          <p className="mt-4 leading-7 text-neutral-600 dark:text-neutral-300">
            This website uses a security service to protect against malicious bots. This page is displayed while the website verifies you are not a bot.
          </p>

          {state === "challenge" && (
            <div className="mt-8">
              <Captcha
                onChange={handleCaptchaSuccess}
                onExpired={() => setError("The verification expired. Please complete it again.")}
                onError={handleCaptchaError}
              />
            </div>
          )}

          {error && (
            <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </p>
          )}
        </div>

        <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
          Mekari needs to review the security of your connection before proceeding.
        </p>
      </section>
    </main>
  );
}
