"use client";

import { FormEvent, useState } from "react";
import axios from "axios";

export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post("http://localhost:4000/api/auth/register", {
        name,
        email,
        password,
      });
      localStorage.setItem("mekari_token", res.data.token);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to sign up");
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
      <div className="space-y-1">
        <label className="block text-xs font-medium text-slate-200">
          Full name
        </label>
        <input
          type="text"
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-primary-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-slate-200">
          Email
        </label>
        <input
          type="email"
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-primary-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-slate-200">
          Password
        </label>
        <input
          type="password"
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-primary-500"
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
        {loading ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}

