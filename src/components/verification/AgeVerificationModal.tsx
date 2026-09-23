'use client';

import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type AgeVerificationModalProps = {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function AgeVerificationModal({ open, onOpenChange }: AgeVerificationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adults only</DialogTitle>
          <DialogDescription>
            DickRank is for people 18 and older. Verify your age to continue.
          </DialogDescription>
        </DialogHeader>
        <Button asChild>
          <Link href="/verify-age">Verify your age to continue</Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
