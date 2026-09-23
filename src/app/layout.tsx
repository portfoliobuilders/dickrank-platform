import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "DickRank",
  description: "18+ creator rankings and reviews.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
