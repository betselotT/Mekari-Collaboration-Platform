"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoginForm } from "../components/auth/LoginForm";
import { RegisterForm } from "../components/auth/RegisterForm";

const queryClient = new QueryClient();

export default function HomePage() {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <QueryClientProvider client={queryClient}>
      <div className="grid gap-8 md:grid-cols-[1.2fr,1fr]">
        <section className="flex flex-col justify-center gap-4">
          <h1 className="text-3xl font-semibold text-slate-50 md:text-4xl">
            Ask. Collaborate. Grow.
          </h1>
          <p className="text-sm text-slate-300 md:text-base">
            MEKARI connects you with peers and mentors for real-time technical
            support. Create threads, jump into live sessions, and build your
            reputation as you help others.
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            <li>• Subject-based channels and threaded discussions</li>
            <li>• Expert matching and helper availability</li>
            <li>• AI-assisted guidance and gamified recognition</li>
          </ul>
        </section>
        <section className="flex flex-col justify-center">
          <div className="mb-4 flex rounded-full bg-slate-800 p-1 text-sm">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 rounded-full px-3 py-2 transition ${
                mode === "login" ? "bg-primary-500 text-white" : "text-slate-300"
              }`}
            >
              Log in
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 rounded-full px-3 py-2 transition ${
                mode === "register"
                  ? "bg-primary-500 text-white"
                  : "text-slate-300"
              }`}
            >
              Sign up
            </button>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            {mode === "login" ? <LoginForm /> : <RegisterForm />}
          </div>
        </section>
      </div>
    </QueryClientProvider>
  );
}

