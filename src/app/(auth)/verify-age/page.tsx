'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { IdVerificationForm } from '@/components/verification/IdVerificationForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function VerifyAgePage() {
  const router = useRouter();
  const { status, update } = useSession();
  const [checking, setChecking] = useState(true);
  const started = useRef(false);

  useEffect(() => {
    if (status === 'loading' || started.current) return;
    started.current = true;
    let cancelled = false;
    async function refresh() {
      if (status === 'unauthenticated') {
        router.replace('/login');
        return;
      }
      const nextSession = await update();
      if (cancelled) return;
      if (nextSession?.user?.ageVerification === true) {
        router.replace('/dashboard');
        return;
      }
      setChecking(false);
    }
    void refresh();
    return () => {
      cancelled = true;
    };
    // Run once after the first settled session. `update` changes identity often.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload government ID to verify 18+</CardTitle>
        <CardDescription>
          Send the front and back of a government ID, plus a live selfie. A reviewer checks them. Uploading does not
          unlock the site.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {checking || status === 'loading' ? (
          <p className="text-sm text-muted-foreground" role="status">
            Checking your account…
          </p>
        ) : (
          <IdVerificationForm />
        )}
        <Button variant="ghost" asChild>
          <Link href="/">Back home</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
