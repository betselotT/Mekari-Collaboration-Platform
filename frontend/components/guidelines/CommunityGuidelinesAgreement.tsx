"use client";

import { ShieldCheck, X } from "lucide-react";
import { useLanguage } from "../../lib/i18n";

const sections = [
  {
    title: "guidelines.eula.collaborationTitle",
    bullets: ["guidelines.eula.collaborationBody", "guidelines.eula.collaborationBody2"],
  },
  {
    title: "guidelines.eula.contentTitle",
    bullets: ["guidelines.eula.contentBody", "guidelines.eula.contentBody2"],
  },
  {
    title: "guidelines.eula.privacyTitle",
    bullets: ["guidelines.eula.privacyBody", "guidelines.eula.privacyBody2"],
  },
  {
    title: "guidelines.eula.messagingTitle",
    bullets: ["guidelines.eula.messagingBody", "guidelines.eula.messagingBody2"],
  },
  {
    title: "guidelines.eula.mentorsTitle",
    bullets: ["guidelines.eula.mentorsBody", "guidelines.eula.mentorsBody2"],
  },
  {
    title: "guidelines.eula.moderationTitle",
    bullets: ["guidelines.eula.moderationBody", "guidelines.eula.moderationBody2"],
  },
  {
    title: "guidelines.eula.aiTitle",
    bullets: ["guidelines.eula.aiBody", "guidelines.eula.aiBody2"],
  },
];

type CommunityGuidelinesAgreementProps = {
  version: string;
  acknowledged: boolean;
  saving?: boolean;
  error?: string | null;
  onAcknowledgedChange: (acknowledged: boolean) => void;
  onConfirm: () => void;
  onClose?: () => void;
};

export function CommunityGuidelinesAgreement({
  version,
  acknowledged,
  saving = false,
  error,
  onAcknowledgedChange,
  onConfirm,
  onClose,
}: CommunityGuidelinesAgreementProps) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/70 px-4 py-6 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-guidelines-title"
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="flex items-start gap-3 border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
          <div className="rounded-lg bg-primary-100 p-2 text-primary-700 dark:bg-primary-950 dark:text-primary-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="community-guidelines-title" className="text-lg font-bold text-neutral-900 dark:text-white">
              {t("guidelines.eula.title")}
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {t("guidelines.eula.version", { version: version || "-" })}
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t("guidelines.eula.close")}
              className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="overflow-y-auto px-5 py-4 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
          <p>{t("guidelines.eula.intro")}</p>
          <div className="mt-4 space-y-4">
            {sections.map((section) => (
              <div key={section.title}>
                <h3 className="font-semibold text-neutral-900 dark:text-white">{t(section.title)}</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-justify">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{t(bullet)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-neutral-200 px-5 py-4 dark:border-neutral-700">
          {error && (
            <p className="mb-3 rounded bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          <label className="flex items-start gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => onAcknowledgedChange(event.target.checked)}
              className="mt-1"
            />
            <span>{t("guidelines.eula.acknowledge")}</span>
          </label>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!version || !acknowledged || saving}
            className="mt-4 w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 dark:disabled:bg-neutral-700 dark:disabled:text-neutral-400"
          >
            {saving ? t("guidelines.eula.accepting") : t("guidelines.eula.confirm")}
          </button>
        </div>
      </section>
    </div>
  );
}
