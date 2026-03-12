"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800/80 dark:border-slate-500"
    >
      {theme === "dark" ? "Light theme" : "Dark theme"}
    </button>
  );
}

