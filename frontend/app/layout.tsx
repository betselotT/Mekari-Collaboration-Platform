import "./globals.css";
import type { ReactNode } from "react";
import { ThemeProvider } from "../components/theme/ThemeProvider";
import { SecurityVerificationGate } from "../components/security/SecurityVerificationGate";

export const metadata = {
  title: "Mekari - Enterprise Hub",
  description: "Real-time technical collaboration platform for enterprise teams",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <SecurityVerificationGate>{children}</SecurityVerificationGate>
        </ThemeProvider>
      </body>
    </html>
  );
}
