"use client";

import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
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
  searchPlaceholder = "Search...",
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <main className="flex min-h-dvh flex-col lg:ml-60">
        {/* Header */}
        <Header
          title={title}
          searchPlaceholder={searchPlaceholder}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-8 pt-20 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
