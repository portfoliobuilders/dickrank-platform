'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { getSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { IdVerificationForm } from '@/components/verification/IdVerificationForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registerSchema } from '@/lib/validations';

const STEPS = ['Account', 'Email', 'Age'] as const;

type PublicUserResponse = {
  user?: { username: string };
  devCode?: string;
  error?: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [queued, setQueued] = useState(false);

  async function submitAccount(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = registerSchema.safeParse({ email, username, password, confirmPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form and try again.');
      return;
    }
    setPending(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json().catch(() => null)) as PublicUserResponse | null;
      if (!response.ok) {
        setError(body?.error ?? 'Could not create the account.');
        return;
      }
      setDevCode(body?.devCode ?? null);
      setStep(1);
    } catch {
      setError('Could not create the account. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? 'That code is wrong or expired.');
        return;
      }
      const signInResult = await signIn('credentials', { email, password, redirect: false });
      if (signInResult?.error) {
        setError('Email confirmed. Sign in to continue age verification.');
        router.push('/login');
        return;
      }
      await getSession();
      setStep(2);
    } catch {
      setError('Could not confirm that code. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>DickRank is 18+ only. Age verification is reviewed by a person.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ol className="grid grid-cols-3 gap-2 text-xs" aria-label="Sign-up progress">
          {STEPS.map((label, index) => (
            <li
              key={label}
              aria-current={step === index ? 'step' : undefined}
              className={`rounded-md border px-2 py-2 text-center ${step === index ? 'border-primary' : 'text-muted-foreground'}`}
            >
              {index + 1}. {label}
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <form className="space-y-4" onSubmit={submitAccount} noValidate>
            <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} />
            <Field
              id="username"
              label="Username"
              autoComplete="username"
              value={username}
              onChange={setUsername}
            />
            <Field
              id="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
            />
            <Field
              id="confirmPassword"
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />
            {error ? <ErrorText message={error} /> : null}
            <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
              {pending ? 'Creating account…' : 'Continue'}
            </Button>
          </form>
        ) : null}

        {step === 1 ? (
          <form className="space-y-4" onSubmit={submitCode}>
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code for {email}. It expires in 15 minutes.
            </p>
            {devCode ? (
              <p className="text-sm">Development code: {devCode}</p>
            ) : null}
            <Field id="code" label="Email code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={setCode} />
            {error ? <ErrorText message={error} /> : null}
            <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
              {pending ? 'Checking code…' : 'Confirm email'}
            </Button>
          </form>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <p className="text-sm font-medium">Upload government ID to verify 18+</p>
            {queued ? (
              <p className="text-sm text-muted-foreground" role="status">
                Submitted. A reviewer still has to approve the account before adult areas open.
              </p>
            ) : (
              <IdVerificationForm onComplete={() => setQueued(true)} />
            )}
          </div>
        ) : null}

        <p className="text-sm text-muted-foreground">
          Already registered?{' '}
          <Link className="text-primary underline-offset-4 hover:underline" href="/login">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: 'numeric' | 'text' | 'email';
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
  );
}

function ErrorText({ message }: { message: string }) {
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
