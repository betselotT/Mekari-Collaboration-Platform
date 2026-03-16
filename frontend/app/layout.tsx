import "./globals.css";
import type { ReactNode } from "react";
import { ThemeProvider } from "../components/theme/ThemeProvider";

export const metadata = {
  title: "Mekari - Enterprise Hub",
  description: "Real-time technical collaboration platform for enterprise teams",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

