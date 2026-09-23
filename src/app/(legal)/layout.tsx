import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="compliance">
      <header className="site">
        <div className="wrap">
          <strong>DickRank</strong>
          <nav>
            <Link href="/">Home</Link>
            <Link href="/dmca">DMCA policy</Link>
            <Link href="/account">Your data</Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
