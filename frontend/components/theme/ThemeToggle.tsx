"use client";

import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700"
      aria-label="Toggle theme"
    >
      {theme === "light" ? (
        <Sun className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
      ) : (
        <Moon className="w-5 h-5 text-neutral-400" />
      )}
    </button>
  );
}

