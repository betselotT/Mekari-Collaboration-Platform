"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ContourField } from "../../../components/visual/ContourField";

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<OAuthShell message="Finishing sign in..." />}>
      <OAuthCallbackContent />
    </Suspense>
  );
}

function OAuthCallbackContent() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Finishing sign in...");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const error = searchParams.get("error");
    const token = searchParams.get("token");

    if (error) {
      setFailed(true);
      setMessage(error);
      return;
    }

    if (!token) {
      setFailed(true);
      setMessage("OAuth did not return a session token.");
      return;
    }

    localStorage.setItem("mekari_token", token);
    window.location.href = "/dashboard";
  }, [searchParams]);

  return <OAuthShell message={message} failed={failed} />;
}

function OAuthShell({ message, failed = false }: { message: string; failed?: boolean }) {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-white px-6 dark:bg-neutral-950">
      <div className="absolute inset-0 -z-30 bg-[radial-gradient(circle_at_15%_20%,rgba(139,92,246,0.18),transparent_28%),radial-gradient(circle_at_85%_12%,rgba(59,130,246,0.12),transparent_24%),linear-gradient(135deg,#ffffff_0%,#faf7ff_54%,#f8fbff_100%)] dark:bg-[radial-gradient(circle_at_15%_20%,rgba(124,58,237,0.24),transparent_27%),radial-gradient(circle_at_82%_25%,rgba(59,130,246,0.16),transparent_22%),linear-gradient(135deg,#050507_0%,#0a0712_52%,#030306_100%)]" />
      <div className="absolute inset-0 -z-20 opacity-50 [background-image:linear-gradient(rgba(109,40,217,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(109,40,217,.06)_1px,transparent_1px)] [background-size:52px_52px] dark:opacity-25 dark:[background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)]" />
      <ContourField className="pointer-events-none absolute -right-36 top-20 -z-10 h-[370px] w-[620px] rotate-[-8deg] opacity-45 dark:opacity-75" />
      <ContourField className="pointer-events-none absolute -bottom-24 -left-36 -z-10 h-[300px] w-[500px] rotate-[165deg] opacity-30 dark:opacity-50" />
      <div className="w-full max-w-md rounded-3xl border border-primary-100 bg-white/90 p-8 text-center shadow-2xl shadow-primary-100/60 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/80 dark:shadow-primary-950/30">
        <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
          {failed ? "Sign-in failed" : "Signing you in"}
        </h1>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">{message}</p>
        {failed && (
          <Link
            href="/login"
            className="mt-6 inline-flex rounded bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
          >
            Back to sign in
          </Link>
        )}
      </div>
    </main>
  );
}
