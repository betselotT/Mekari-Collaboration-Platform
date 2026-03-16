"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-neutral-950">
      {/* Navigation */}
      <nav className="border-b border-neutral-200 bg-white px-6 py-4 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-white font-bold">
              M
            </div>
            <span className="text-xl font-bold text-neutral-900 dark:text-white">Mekari</span>
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      {/* Login Form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 dark:border-neutral-700 dark:bg-neutral-800">
          <h1 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">Welcome Back</h1>
          <p className="mb-8 text-neutral-600 dark:text-neutral-400">
            Access your technical community
          </p>

          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-900 dark:text-white mb-2">
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                placeholder="name@company.com"
                className="input"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-neutral-900 dark:text-white">
                  PASSWORD
                </label>
                <a href="#" className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400">
                  Forgot?
                </a>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                className="input"
              />
            </div>

            <Link href="/dashboard/threads" className="block">
              <Button variant="primary" size="lg" className="w-full">
                Sign in
              </Button>
            </Link>

            <div className="relative flex items-center gap-4">
              <div className="flex-1 border-t border-neutral-200 dark:border-neutral-700" />
              <span className="text-xs text-neutral-500">OR</span>
              <div className="flex-1 border-t border-neutral-200 dark:border-neutral-700" />
            </div>

            <Button variant="secondary" size="lg" className="w-full">
              Continue with Google
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
            Don't have an account?{" "}
            <Link href="/register" className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
