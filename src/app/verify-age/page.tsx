import { VerifyAgeForm } from "@/app/verify-age/VerifyAgeForm";
import { SetupNotice } from "@/components/SetupNotice";
import { isDemoMode } from "@/lib/demo";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function VerifyAgePage() {
  const viewer = await getViewer();
  const configured = Boolean(viewer.supabase) || isDemoMode();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold">Adults only</h1>
      <p className="mt-3 text-zinc-300">
        DickRank is for people 18 and older. Confirm your age before viewing creator profiles or posts.
      </p>
      <div className="mt-8">
        {configured ? <VerifyAgeForm alreadyVerified={Boolean(viewer.profile?.ageVerified)} signedIn={Boolean(viewer.profile)} /> : <SetupNotice />}
      </div>
    </main>
  );
}
