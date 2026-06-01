"use client";

import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useLanguage } from "../../lib/i18n";
import { CommunityGuidelinesModal } from "../guidelines/CommunityGuidelinesModal";
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
    <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
      <CommunityGuidelinesModal />

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <main className="flex min-h-dvh min-w-0 flex-col lg:ml-60">
        {/* Header */}
        <Header title={title === "Dashboard" ? t("header.dashboard") : title} onMenuClick={() => setSidebarOpen(true)} />

        {/* Page Content */}
        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-6 pt-20 sm:px-6 sm:pb-8 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
