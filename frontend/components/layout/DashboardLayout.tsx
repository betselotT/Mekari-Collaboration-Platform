"use client";

import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  searchPlaceholder?: string;
}

export function DashboardLayout({
  children,
  title = "Dashboard",
  searchPlaceholder = "Search...",
}: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex flex-col flex-1 ml-60">
        {/* Header */}
        <Header title={title} searchPlaceholder={searchPlaceholder} />

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto pt-20 pb-8 px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
