import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DickRank",
  description: "Creator subscriptions and premium posts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
