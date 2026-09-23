import type { ReactNode } from "react";

export const metadata = {
  title: "DickRank",
  description: "Adults 18 and older only.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
