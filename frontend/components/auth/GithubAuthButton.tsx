"use client";

import { getApiBaseUrl } from "../../lib/api";

type AccountType = "learner" | "mentor";
type AuthMode = "login" | "register";

export function GithubAuthButton({
  accountType,
  mode,
}: {
  accountType: AccountType;
  mode: AuthMode;
}) {
  const href = `${getApiBaseUrl()}/api/auth/github/start?accountType=${accountType}&mode=${mode}`;

  return (
    <a
      href={href}
      className="flex w-full items-center justify-center rounded border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
    >
      Continue with GitHub
    </a>
  );
}
