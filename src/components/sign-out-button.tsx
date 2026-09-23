'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        setPending(true);
        void signOut({ callbackUrl: '/' });
      }}
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}
