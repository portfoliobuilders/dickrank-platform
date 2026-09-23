'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string; devToken?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? 'Could not start a reset.');
        return;
      }
      setDevToken(body?.devToken ?? null);
      setMessage('If that email has an account, reset instructions are ready.');
    } catch {
      setError('Could not start a reset. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot password</CardTitle>
        <CardDescription>We will not say whether the email is registered.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-sm" role="status">
              {message}
            </p>
          ) : null}
          {devToken ? (
            <p className="text-sm">
              Development reset link:{' '}
              <Link className="text-primary underline" href={`/reset-password?token=${devToken}`}>
                choose a new password
              </Link>
            </p>
          ) : null}
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {pending ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
        <Link className="text-sm text-primary underline-offset-4 hover:underline" href="/login">
          Back to sign in
        </Link>
      </CardContent>
    </Card>
  );
}
