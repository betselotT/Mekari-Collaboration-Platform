"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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
    <main className="flex min-h-screen items-center justify-center bg-white px-6 dark:bg-neutral-950">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-700 dark:bg-neutral-900">
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
