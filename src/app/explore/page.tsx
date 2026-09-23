'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { AgeVerificationModal } from '@/components/verification/AgeVerificationModal';
import { Button } from '@/components/ui/button';

export default function ExplorePage() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const verified = session?.user?.ageVerification === true;

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Explore</h1>
      <p className="mt-3 text-muted-foreground">
        Public page. Adult rankings stay behind age verification.
      </p>
      <Button
        className="mt-8"
        onClick={() => {
          if (status === 'authenticated' && !verified) setOpen(true);
          if (status !== 'authenticated') window.location.href = '/register';
          if (verified) window.location.href = '/dashboard';
        }}
      >
        Open adult rankings
      </Button>
      <AgeVerificationModal open={open} onOpenChange={setOpen} />
    </main>
  );
}
