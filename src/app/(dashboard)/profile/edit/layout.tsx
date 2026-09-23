import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EditProfileLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer.profile?.ageVerified) redirect("/verify-age");
  return children;
}
