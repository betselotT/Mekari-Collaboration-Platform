"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Users,
  BarChart3,
  User,
  Bot,
  ShieldAlert,
  Code2,
  Cpu,
  Cog,
  Wrench,
  Zap,
  X,
} from "lucide-react";
import { TranslationKey, useLanguage } from "../../lib/i18n";
import { ContourField } from "../visual/ContourField";

export interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  labelKey: TranslationKey;
  href: string;
}

const mainMenu: NavItem[] = [
  { icon: MessageSquare, labelKey: "nav.threads", href: "/dashboard/threads" },
  { icon: Zap, labelKey: "nav.match", href: "/dashboard/match" },
  { icon: Users, labelKey: "nav.experts", href: "/dashboard/experts" },
  { icon: BarChart3, labelKey: "nav.leaderboard", href: "/dashboard/leaderboard" },
  { icon: Bot, labelKey: "nav.aiAssistant", href: "/dashboard/ai-assistant" },
  { icon: ShieldAlert, labelKey: "nav.reportUser", href: "/dashboard/reports" },
  { icon: User, labelKey: "nav.profile", href: "/dashboard/profile" },
];

const subjectsMenu: NavItem[] = [
  { icon: Code2, labelKey: "nav.softwareEngineering", href: "/dashboard/subjects/software-engineering" },
  { icon: Cpu, labelKey: "nav.electricalEngineering", href: "/dashboard/subjects/electrical-engineering" },
  { icon: Cog, labelKey: "nav.mechanicalEngineering", href: "/dashboard/subjects/mechanical-engineering" },
  { icon: Wrench, labelKey: "nav.electromechanicalEngineering", href: "/dashboard/subjects/electromechanical-engineering" },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

function SidebarContent({ onNavigate, showClose }: { onNavigate?: () => void; showClose?: boolean }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Logo */}
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-white font-bold">
            M
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-base font-bold text-neutral-900 dark:text-white">Mekari</span>
            <span className="text-xs text-neutral-600 dark:text-neutral-400">{t("Knowledge Hub")}</span>
          </div>
        </div>
        {showClose && (
          <button
            type="button"
            onClick={onNavigate}
            className="rounded-lg p-2 text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            aria-label={t("header.closeNavigation")}
            title={t("header.closeNavigation")}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Main Menu */}
      <nav className="mb-8 flex flex-col gap-1">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {t("nav.mainMenu")}
        </div>
        {mainMenu.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-primary-600 text-white"
                  : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      {/* Subjects Menu */}
      <nav className="mb-8 flex flex-col gap-1">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {t("nav.subjects")}
        </div>
        {subjectsMenu.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { t } = useLanguage();

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-60 flex-col overflow-y-auto border-r border-neutral-200 bg-white px-6 py-6 dark:border-neutral-700 dark:bg-neutral-900 lg:flex">
        <ContourField className="pointer-events-none absolute -bottom-12 -left-24 h-52 w-[350px] rotate-[155deg] opacity-[0.09] dark:opacity-[0.16]" />
        <SidebarContent />
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-black/40"
            onClick={onClose}
            aria-label={t("header.closeNavigation")}
          />
          <aside className="relative flex h-dvh w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-neutral-200 bg-white px-6 py-6 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
            <ContourField className="pointer-events-none absolute -bottom-12 -left-24 h-52 w-[350px] rotate-[155deg] opacity-[0.09] dark:opacity-[0.16]" />
            <SidebarContent onNavigate={onClose} showClose />
          </aside>
        </div>
      )}
    </>
  );
}
