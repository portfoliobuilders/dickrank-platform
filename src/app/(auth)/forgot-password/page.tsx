"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { forgotPasswordSchema } from "@/lib/schemas";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email");
      return;
    }
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    setSent(true);
    setLoading(false);
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <h1 className="text-xl font-semibold text-white">Forgot password</h1>
        <p className="text-sm leading-6 text-zinc-300">
          Enter your email. Reset email is not turned on yet, so this check only validates the address and does not
          send a message or reveal whether an account exists.
        </p>
        {error ? (
          <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100" role="alert">
            {error}
          </p>
        ) : null}
        {sent ? (
          <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100" role="status">
            No reset email was sent. Password reset is not available yet.
          </p>
        ) : null}
        <label className="block text-sm" htmlFor="email">
          <span className="mb-1.5 block font-medium text-zinc-200">Email</span>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none ring-rose-400 focus:ring-2"
          />
        </label>
        <button
          type="submit"
          disabled={loading || sent}
          className="w-full rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send reset instructions"}
        </button>
        <p className="text-center text-sm">
          <Link href="/login" className="font-medium text-zinc-300 hover:text-white">
            Back to sign in
          </Link>
        </p>
      </form>
    </section>
  );
}
