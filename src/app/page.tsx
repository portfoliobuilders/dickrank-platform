import { AccountTools } from "@/app/account-tools";

export const dynamic = "force-dynamic";

export default function HomePage({
  searchParams,
}: {
  searchParams?: { notice?: string };
}) {
  return (
    <main className="wrap">
      <h1>18+ only</h1>
      <p className="muted">
        DickRank is an adult platform. You must be 18 or older to view or upload content.
      </p>
      {searchParams?.notice === "age" ? (
        <p className="banner error">Staff tools that show content require a verified 18+ admin account.</p>
      ) : null}
      <div className="card">
        <h2>Copyright</h2>
        <p>
          To report copyrighted material, use the <a href="/dmca">DMCA policy page</a>. The designated
          address is dmca@dickrank.online.
        </p>
      </div>
      <AccountTools />
    </main>
  );
}
