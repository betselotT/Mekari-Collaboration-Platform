import "./globals.css";
import type { ReactNode } from "react";
import { ThemeProvider } from "../components/theme/ThemeProvider";
import { ThemeToggle } from "../components/theme/ThemeToggle";

export const metadata = {
  title: "MEKARI Collaboration Platform",
  description: "Real-time technical peer support for AASTU and beyond",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <ThemeProvider>
          <header className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary-500 px-3 py-1 text-sm font-semibold uppercase tracking-wide">
                Mekari
              </span>
              <span className="text-base text-slate-400">
                Real-time technical collaboration
              </span>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 md:p-1">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}

