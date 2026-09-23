'use client';

import { useState } from 'react';
import { formatCount } from '@/lib/format';

interface SubscribeButtonProps {
  username: string;
  initialSubscribed: boolean;
  initialFollowerCount: number;
  onFollowerCount?: (count: number) => void;
}

export function SubscribeButton({
  username,
  initialSubscribed,
  initialFollowerCount,
  onFollowerCount,
}: SubscribeButtonProps) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [followers, setFollowers] = useState(initialFollowerCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    if (pending) return;
    const previous = { subscribed, followers };
    const nextSubscribed = !subscribed;
    const nextFollowers = Math.max(0, followers + (nextSubscribed ? 1 : -1));
    setSubscribed(nextSubscribed);
    setFollowers(nextFollowers);
    onFollowerCount?.(nextFollowers);
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/creators/${username}/subscribe`, { method: 'POST' });
      const body = (await response.json()) as { subscribed?: boolean; followerCount?: number; error?: string };
      if (response.status === 401 || response.status === 403) {
        window.location.href = '/age-verification';
        return;
      }
      if (!response.ok || typeof body.subscribed !== 'boolean' || typeof body.followerCount !== 'number') {
        throw new Error(body.error || 'Could not update subscription');
      }
      setSubscribed(body.subscribed);
      setFollowers(body.followerCount);
      onFollowerCount?.(body.followerCount);
    } catch (cause) {
      setSubscribed(previous.subscribed);
      setFollowers(previous.followers);
      onFollowerCount?.(previous.followers);
      setError(cause instanceof Error ? cause.message : 'Could not update subscription');
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void toggle()}
        aria-pressed={subscribed}
        className={`rounded-full px-4 py-2 text-sm font-semibold ${subscribed ? 'bg-zinc-800 text-white' : 'bg-rose-600 text-white hover:bg-rose-500'}`}
      >
        {subscribed ? 'Subscribed' : 'Subscribe'}
      </button>
      <span className="sr-only">{formatCount(followers)} followers</span>
      {error ? <p className="mt-1 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
