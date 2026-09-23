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
  return children;
}
