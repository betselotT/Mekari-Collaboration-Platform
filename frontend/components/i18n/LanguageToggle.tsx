"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "../../lib/i18n";

export function LanguageToggle() {
  const { language, toggleLanguage, t } = useLanguage();
  const nextLabel = language === "en" ? t("language.amharic") : t("language.english");

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      aria-label={t("language.toggleLabel")}
      title={`${t("language.toggleLabel")}: ${nextLabel}`}
    >
      <Languages className="h-4 w-4" />
      <span>{language === "en" ? "AM" : "EN"}</span>
    </button>
  );
}
