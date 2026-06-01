"use client";

import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useLanguage } from "../../lib/i18n";
import { ContourField } from "../visual/ContourField";
// Props for configuring the dashboard layout structure and header content
interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  searchPlaceholder?: string;
}
// Main dashboard layout wrapper with shared sidebar and header navigation
export function DashboardLayout({
  children,
  title = "Dashboard",
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      <div className="pointer-events-none fixed inset-0 -z-20 opacity-45 [background-image:linear-gradient(rgba(109,40,217,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(109,40,217,.035)_1px,transparent_1px)] [background-size:52px_52px] dark:opacity-20 dark:[background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)]" />
      <ContourField className="pointer-events-none fixed -right-44 top-20 -z-10 h-72 w-[480px] rotate-[-10deg] opacity-[0.12] dark:opacity-[0.2]" />
      <ContourField className="pointer-events-none fixed -bottom-28 left-48 -z-10 h-64 w-[440px] rotate-[168deg] opacity-[0.08] dark:opacity-[0.14]" />
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <main className="flex min-h-dvh min-w-0 flex-col lg:ml-60">
        {/* Header */}
        <Header title={title === "Dashboard" ? t("header.dashboard") : title} onMenuClick={() => setSidebarOpen(true)} />

        {/* Page Content */}
        <div className="relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-6 pt-20 sm:px-6 sm:pb-8 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
