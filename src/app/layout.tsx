import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Upload content",
  description: "Age-verified content upload",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
