"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { AgeVerificationModal } from "@/components/verification/AgeVerificationModal";

export default function ExplorePage() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ageVerified = session?.user.ageVerified === true;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">Explore</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">Rankings stay locked until you are verified</h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-300">
        Public pages do not show adult content. Verification is required before any 18+ material is available.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={status === "loading"}
        className="mt-8 w-fit rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
      >
        {status === "loading" ? "Checking account…" : "View adult rankings"}
      </button>
      {open && ageVerified ? (
        <p className="mt-4 text-sm text-emerald-300" role="status">
          Your age is verified. Rankings will show here when content is published.
        </p>
      ) : null}
      <AgeVerificationModal open={open && !ageVerified && status !== "loading"} onClose={() => setOpen(false)} />
    </main>
  );
}
