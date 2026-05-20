"use client";

import { Github } from "lucide-react";
import { getApiBaseUrl } from "../../lib/api";

type AccountType = "learner" | "mentor";
type AuthMode = "login" | "register";

export function GithubAuthButton({
  accountType,
  mode,
  className = "",
}: {
  accountType?: AccountType;
  mode: AuthMode;
  className?: string;
}) {
  const params = new URLSearchParams({ mode });
  if (accountType) {
    params.set("accountType", accountType);
  }
  const href = `${getApiBaseUrl()}/api/auth/github/start?${params.toString()}`;

  return (
    <a
      href={href}
      className={`flex h-10 w-full items-center justify-center rounded border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 ${className}`}
    >
      <Github className="mr-2 h-4 w-4" aria-hidden="true" />
      Continue with GitHub
    </a>
  );
}
