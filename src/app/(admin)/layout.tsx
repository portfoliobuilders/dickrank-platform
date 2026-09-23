import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/");
  }
  if (!user.ageVerified) {
    redirect("/?notice=age");
  }
  return (
    <div className="compliance">
      <header className="site">
        <div className="wrap">
          <strong>DickRank staff</strong>
          <nav>
            <a href="/audit">Audit log</a>
            <a href="/claims">Copyright claims</a>
            <a href="/">Home</a>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
