"use client";

import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || "Invalid admin credential");
      }

      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand login-brand">
          <div className="brand-mark">M</div>
          <div>
            <h1>Mekari Admin</h1>
            <p>Sign in with the seeded admin credential</p>
          </div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            <span>Username</span>
            <input
              className="input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="button login-button" disabled={loading} type="submit">
            {loading ? "Checking..." : "Open dashboard"}
          </button>
        </form>
{/* 
        <div className="seeded-credential">
          <span>Seeded credential</span>
          <strong>admin / MekariAdmin2026!</strong>
        </div> */}
      </section>
    </main>
  );
}
