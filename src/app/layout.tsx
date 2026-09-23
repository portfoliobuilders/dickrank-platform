import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DickRank",
  description: "Adult content discovery and creator profiles for people 18 and older.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">{children}</body>
    </html>
  );
}
