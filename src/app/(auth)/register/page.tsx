"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useMemo, useState, type FormEvent } from "react";
import type { ZodError } from "zod";
import { registerSchema, type RegisterInput } from "@/lib/schemas";

const STEPS = ["Account info", "Email verification", "Age verification"] as const;

type FieldErrors = Partial<Record<keyof RegisterInput, string>>;

function issuesFromZod(error: ZodError<RegisterInput>): FieldErrors {
  const flattened = error.flatten().fieldErrors;
  return {
    email: flattened.email?.[0],
    username: flattened.username?.[0],
    password: flattened.password?.[0],
    confirmPassword: flattened.confirmPassword?.[0],
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<RegisterInput>({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  function updateField(key: keyof RegisterInput, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(issuesFromZod(parsed.error));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok && response.status !== 503) {
        setFormError(payload.error ?? "Could not create the account");
        return;
      }
      if (response.status === 503) {
        setFormError(payload.error ?? "Verification email could not be sent. Use resend on the next step.");
      }
      setForm(parsed.data);
      setStep(1);
    } catch {
      setFormError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!/^\d{6}$/.test(code)) {
      setFormError("Enter the 6-digit code from your email.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.email, code }),
      });
      const payload = (await response.json()) as { error?: string; verified?: boolean };
      if (!response.ok || !payload.verified) {
        setFormError(payload.error ?? "Could not verify that code");
        return;
      }

      const signInResult = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (signInResult?.error) {
        setFormError("Email verified. Sign in to continue to age verification.");
        router.push("/login?callbackUrl=/verify-age");
        return;
      }
      setStep(2);
    } catch {
      setFormError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setFormError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: "resend", email: form.email }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setFormError(payload.error ?? "Could not resend the code");
        return;
      }
      setFormError("A new code has been sent if that account is waiting for verification.");
    } catch {
      setFormError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
      <ol className="grid grid-cols-3 gap-2 text-center text-[11px] font-medium text-zinc-400">
        {STEPS.map((label, index) => (
          <li key={label} className={index === step ? "text-white" : index < step ? "text-emerald-300" : undefined}>
            {index + 1}. {label}
          </li>
        ))}
      </ol>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800" aria-hidden="true">
        <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${progress}%` }} />
      </div>

      {formError ? (
        <p className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100" role="alert">
          {formError}
        </p>
      ) : null}

      {step === 0 ? (
        <form className="mt-6 space-y-4" onSubmit={submitAccount} noValidate>
          <h1 className="text-xl font-semibold text-white">Create your account</h1>
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            error={fieldErrors.email}
            onChange={(value) => updateField("email", value)}
          />
          <Field
            label="Username"
            autoComplete="username"
            value={form.username}
            error={fieldErrors.username}
            onChange={(value) => updateField("username", value)}
          />
          <Field
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            error={fieldErrors.password}
            onChange={(value) => updateField("password", value)}
          />
          <Field
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            error={fieldErrors.confirmPassword}
            onChange={(value) => updateField("confirmPassword", value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Continue"}
          </button>
          <p className="text-center text-sm text-zinc-400">
            Already registered?{" "}
            <Link href="/login" className="font-medium text-white hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      ) : null}

      {step === 1 ? (
        <form className="mt-6 space-y-4" onSubmit={submitCode}>
          <h1 className="text-xl font-semibold text-white">Check your email</h1>
          <p className="text-sm leading-6 text-zinc-300">
            Enter the 6-digit code sent to <span className="text-white">{form.email}</span>. It expires in 15 minutes.
          </p>
          <Field label="Verification code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={setCode} />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
          >
            {loading ? "Checking code…" : "Verify email"}
          </button>
          <button
            type="button"
            onClick={resendCode}
            disabled={loading}
            className="w-full text-sm font-medium text-zinc-300 hover:text-white disabled:opacity-60"
          >
            Resend code
          </button>
        </form>
      ) : null}

      {step === 2 ? (
        <div className="mt-6 space-y-4">
          <h1 className="text-xl font-semibold text-white">Verify that you are 18+</h1>
          <p className="text-sm leading-6 text-zinc-300">
            Upload a government ID and a selfie. A reviewer checks them before adult areas of the site unlock. Your
            documents are encrypted and are not shown on your profile.
          </p>
          <button
            type="button"
            onClick={() => router.push("/verify-age")}
            className="w-full rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400"
          >
            Continue to age verification
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "text" | "email";
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <label className="block text-sm" htmlFor={id}>
      <span className="mb-1.5 block font-medium text-zinc-200">{label}</span>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none ring-rose-400 placeholder:text-zinc-500 focus:ring-2"
      />
      {error ? <span className="mt-1 block text-xs text-rose-300">{error}</span> : null}
    </label>
  );
}
