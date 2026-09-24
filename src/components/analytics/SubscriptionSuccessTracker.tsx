'use client';

import { useEffect } from 'react';
import { analytics } from '@/lib/analytics';

const PENDING_SUBSCRIPTION_KEY = 'dickrank_pending_subscription';

export function rememberPendingSubscription(creatorId: string, tier: string, price: number) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(PENDING_SUBSCRIPTION_KEY, JSON.stringify({ creatorId, tier, price }));
}

export function SubscriptionSuccessTracker({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    const raw = sessionStorage.getItem(PENDING_SUBSCRIPTION_KEY);
    sessionStorage.removeItem(PENDING_SUBSCRIPTION_KEY);
    if (!raw) return;
    try {
      const pending = JSON.parse(raw) as { creatorId?: string; tier?: string; price?: number };
      if (!pending.creatorId || !pending.tier || typeof pending.price !== 'number') return;
      analytics.trackSubscription(pending.creatorId, pending.tier, pending.price);
    } catch {
      return;
    }
  }, [active]);

  return null;
}
