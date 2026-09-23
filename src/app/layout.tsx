import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "DickRank",
  description: "Audit records, copyright claims, and account privacy tools.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site">
          <div className="wrap">
            <strong>DickRank</strong>
            <nav>
              <Link href="/">Home</Link>
              <Link href="/dmca">DMCA policy</Link>
              <Link href="/audit">Audit log</Link>
              <Link href="/claims">Copyright claims</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
