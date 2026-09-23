"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function VerifyAgeForm({ alreadyVerified, signedIn }: { alreadyVerified: boolean; signedIn: boolean }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Sign-in needs Supabase.");
      return;
    }
    setPending(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/verify-age` },
    });
    setPending(false);
    if (signInError) setError(signInError.message);
    else setMessage("Check your email for a sign-in link.");
  }

  async function confirmAge(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/profile/age-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmedAdult: true }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(body.error || "Could not save age verification");
      return;
    }
    router.push("/feed");
    router.refresh();
  }

  if (alreadyVerified) {
    return (
      <Button onClick={() => router.push("/feed")}>Continue to the feed</Button>
    );
  }

  return (
    <div className="space-y-6">
      {!signedIn ? (
        <form onSubmit={(event) => void sendLink(event)} className="space-y-3">
          <label className="block text-sm text-zinc-300">
            Email
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <Button type="submit" variant="secondary" disabled={pending}>
            Email me a sign-in link
          </Button>
        </form>
      ) : null}
      <form onSubmit={(event) => void confirmAge(event)} className="space-y-4">
        <label className="flex items-start gap-3 text-sm text-zinc-200">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          I confirm I am 18 or older.
        </label>
        <Button type="submit" disabled={!confirmed || pending || !signedIn}>
          Enter
        </Button>
      </form>
      {message ? <p className="text-sm text-emerald-200">{message}</p> : null}
      {error ? <p className="text-sm text-red-200">{error}</p> : null}
    </div>
  );
}
