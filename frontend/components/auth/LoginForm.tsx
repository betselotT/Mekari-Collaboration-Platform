"use client";

import { FormEvent, useState } from "react";
import { apiClient } from "../../lib/api";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { GithubAuthButton } from "./GithubAuthButton";

type AccountType = "learner" | "mentor";

function getAuthErrorMessage(err: any, fallback: string) {
  return err.response?.data?.message || err.response?.data?.error?.message || fallback;
}

export function LoginForm() {
  const [accountType, setAccountType] = useState<AccountType>("learner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.post("/api/auth/login", {
        email,
        password,
        accountType,
      });
      localStorage.setItem("mekari_token", res.data.token);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(getAuthErrorMessage(err, "Failed to log in"));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignIn(credential: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post("/api/auth/google", { credential, accountType });
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
        <p className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 rounded bg-neutral-100 p-1 dark:bg-neutral-900">
        {(["learner", "mentor"] as AccountType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setAccountType(type)}
            className={`rounded px-3 py-2 text-sm font-medium transition ${
              accountType === type
                ? "bg-white text-primary-700 shadow-sm dark:bg-neutral-800 dark:text-primary-300"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            {type === "mentor" ? "Sign in as mentor" : "Sign in as learner"}
          </button>
        ))}
      </div>
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
      <div className="space-y-2 pt-2">
        <GoogleAuthButton onCredential={onGoogleSignIn} onError={setError} />
        <GithubAuthButton accountType={accountType} mode="login" />
      </div>
    </form>
  );
}

