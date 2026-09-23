"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { Suspense, useState, type FormEvent } from "react";
import { getPostLoginPath } from "@/lib/age-gate";
import { loginSchema } from "@/lib/schemas";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Loading sign in…</p>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Check your email and password");
      return;
    }

    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid email or password");
        return;
      }
      const session = await getSession();
      const destination = getPostLoginPath(session?.user.ageVerified === true, searchParams.get("callbackUrl"));
      router.push(destination);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <h1 className="text-xl font-semibold text-white">Sign in</h1>
        <p className="text-sm text-zinc-400">Use the email and password from your account. Age-restricted pages stay locked until review is approved.</p>
        {error ? (
          <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100" role="alert">
            {error}
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
        <label className="block text-sm" htmlFor="password">
          <span className="mb-1.5 flex items-center justify-between font-medium text-zinc-200">
            Password
            <Link href="/forgot-password" className="text-xs font-medium text-rose-300 hover:text-rose-200">
              Forgot password
            </Link>
          </span>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none ring-rose-400 focus:ring-2"
          />
        </label>
        {fieldError ? <p className="text-xs text-rose-300">{fieldError}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-sm text-zinc-400">
          New here?{" "}
          <Link href="/register" className="font-medium text-white hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </section>
  );
}
