"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Users,
  BarChart3,
  User,
  Bot,
  Code2,
  Database,
  Layers,
  GitBranch,
  Zap,
} from "lucide-react";

export interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

const mainMenu: NavItem[] = [
  { icon: MessageSquare, label: "Threads", href: "/dashboard/threads" },
  { icon: Users, label: "Experts", href: "/dashboard/experts" },
  { icon: BarChart3, label: "Leaderboard", href: "/dashboard/leaderboard" },
  { icon: User, label: "Profile", href: "/dashboard/profile" },
  { icon: Bot, label: "AI Assistant", href: "/dashboard/ai-assistant" },
];

const subjectsMenu: NavItem[] = [
  { icon: Code2, label: "Software Engineering", href: "/dashboard/subjects/software-engineering" },
  { icon: Database, label: "Data Structures", href: "/dashboard/subjects/data-structures" },
  { icon: Layers, label: "System Design", href: "/dashboard/subjects/system-design" },
  { icon: GitBranch, label: "DevOps", href: "/dashboard/subjects/devops" },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 border-r border-neutral-200 bg-white px-6 py-6 overflow-y-auto dark:border-neutral-700 dark:bg-neutral-900 flex flex-col">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-white font-bold">
          M
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold text-neutral-900 dark:text-white">Mekari</span>
          <span className="text-xs text-neutral-600 dark:text-neutral-400">KNOWLEDGE HUB</span>
        </div>
      </div>

      {/* Main Menu */}
      <nav className="mb-8 flex flex-col gap-1">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Main Menu
        </div>
        {mainMenu.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-primary-600 text-white"
                  : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Subjects Menu */}
      <nav className="mb-8 flex flex-col gap-1">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Subjects
        </div>
        {subjectsMenu.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Pro Plan Card */}
      <div className="mt-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
          Pro Plan
        </div>
        <p className="mb-4 text-xs text-neutral-600 dark:text-neutral-400">
          Get unlimited AI responses and expert access.
        </p>
        <button className="w-full rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700">
          Upgrade Now
        </button>
      </div>
    </aside>
  );
}
