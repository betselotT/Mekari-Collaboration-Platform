import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mekari Admin",
  description: "Mekari moderation and verification dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
