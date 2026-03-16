"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function RegisterPage() {
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

      {/* Registration Form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 dark:border-neutral-700 dark:bg-neutral-800">
          <h1 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">Create Account</h1>
          <p className="mb-8 text-neutral-600 dark:text-neutral-400">
            Join our technical community
          </p>

          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-900 dark:text-white mb-2">
                FULL NAME
              </label>
              <input
                type="text"
                placeholder="Your name"
                className="input"
              />
            </div>

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
              <label className="block text-sm font-medium text-neutral-900 dark:text-white mb-2">
                PASSWORD
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-900 dark:text-white mb-2">
                CONFIRM PASSWORD
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="input"
              />
            </div>

            <div className="flex items-start gap-2">
              <input type="checkbox" id="terms" className="mt-1" />
              <label htmlFor="terms" className="text-xs text-neutral-600 dark:text-neutral-400">
                I agree to the Terms of Service and Privacy Policy
              </label>
            </div>

            <Link href="/dashboard/threads" className="block">
              <Button variant="primary" size="lg" className="w-full">
                Create Account
              </Button>
            </Link>

            <div className="relative flex items-center gap-4">
              <div className="flex-1 border-t border-neutral-200 dark:border-neutral-700" />
              <span className="text-xs text-neutral-500">OR</span>
              <div className="flex-1 border-t border-neutral-200 dark:border-neutral-700" />
            </div>

            <Button variant="secondary" size="lg" className="w-full">
              Sign up with Google
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
