import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");
  if (!session.user.ageVerified) redirect("/verify-age");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Age verified</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">Welcome, {session.user.username}</h1>
      <p className="mt-4 text-sm leading-6 text-zinc-300">
        Your account is approved for 18+ areas. Creator tools and uploads use this same age check.
      </p>
    </main>
  );
}
