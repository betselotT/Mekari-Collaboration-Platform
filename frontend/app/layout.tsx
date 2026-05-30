import "./globals.css";
import type { ReactNode } from "react";
import { ThemeProvider } from "../components/theme/ThemeProvider";
import { SecurityVerificationGate } from "../components/security/SecurityVerificationGate";
import { PublicConfigProvider } from "../lib/publicConfig";
import { LanguageProvider } from "../lib/i18n";

export const metadata = {
  title: "Mekari - Enterprise Hub",
  description: "Real-time technical collaboration platform for enterprise teams",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  const publicConfig = {
    googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
    googleAllowedOrigins: process.env.NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS || "",
    recaptchaSiteKey:
      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ||
      process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ||
      "",
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <PublicConfigProvider value={publicConfig}>
          <LanguageProvider>
            <ThemeProvider>
              <SecurityVerificationGate>{children}</SecurityVerificationGate>
            </ThemeProvider>
          </LanguageProvider>
        </PublicConfigProvider>
      </body>
    </html>
  );
}
