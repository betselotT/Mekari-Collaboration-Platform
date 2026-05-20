"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { apiClient } from "../../lib/api";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { GithubAuthButton } from "./GithubAuthButton";

function getAuthErrorMessage(err: any, fallback: string) {
  return err.response?.data?.message || err.response?.data?.error?.message || fallback;
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNeedsEmailVerification(false);

    try {
      const res = await apiClient.post("/api/auth/login", {
        email,
        password,
      });
      localStorage.setItem("mekari_token", res.data.token);
      window.location.href = "/dashboard";
    } catch (err: any) {
      const message = getAuthErrorMessage(err, "Failed to log in");
      setError(message);
      setNeedsEmailVerification(message.toLowerCase().includes("verify your email"));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignIn(credential: string) {
    setLoading(true);
    setError(null);
    setNeedsEmailVerification(false);
    try {
      const res = await apiClient.post("/api/auth/google", { credential });
      localStorage.setItem("mekari_token", res.data.token);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(getAuthErrorMessage(err, "Google sign-in failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-sm">
      {error && (
        <div className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <p>{error}</p>
          {needsEmailVerification && (
            <Link
              href={`/verify-email${email ? `?email=${encodeURIComponent(email)}` : ""}`}
              className="mt-2 inline-flex font-semibold text-red-200 underline underline-offset-2 hover:text-white"
            >
              Verify your email
            </Link>
          )}
        </div>
      )}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
          Email
        </label>
        <input
          type="email"
          className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-primary-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
          Password
        </label>
        <input
          type="password"
          className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-primary-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 w-full rounded bg-primary-500 px-3 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
      <div className="grid grid-cols-2 gap-2 pt-2">
        <GoogleAuthButton onCredential={onGoogleSignIn} onError={setError} />
        <GithubAuthButton mode="login" />
      </div>
    </form>
  );
}

