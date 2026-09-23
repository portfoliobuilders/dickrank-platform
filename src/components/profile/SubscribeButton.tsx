'use client';

import { useState } from 'react';
import { formatCount } from '@/lib/format';

export function SubscribeButton({
  username,
  initialSubscribed,
  initialFollowerCount,
}: {
  username: string;
  initialSubscribed: boolean;
  initialFollowerCount: number;
}) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    if (pending) return;
    const previous = { subscribed, followerCount };
    const next = !subscribed;
    setSubscribed(next);
    setFollowerCount((value) => Math.max(0, value + (next ? 1 : -1)));
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/creators/${username}/subscribe`, { method: 'POST' });
      const body = (await response.json()) as {
        subscribed?: boolean;
        followerCount?: number;
        error?: string;
      };
      if (response.status === 401 || response.status === 403) {
        window.location.href = `/verify-age?next=/creator/${username}`;
        return;
      }
      if (!response.ok || typeof body.subscribed !== 'boolean' || typeof body.followerCount !== 'number') {
        throw new Error(body.error || 'Could not update subscription');
      }
      setSubscribed(body.subscribed);
      setFollowerCount(body.followerCount);
    } catch (cause) {
      setSubscribed(previous.subscribed);
      setFollowerCount(previous.followerCount);
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
        className={`rounded-full px-5 py-2 text-sm font-semibold ${
          subscribed ? 'bg-zinc-800 text-zinc-100' : 'bg-rose-600 text-white'
        }`}
      >
        {subscribed ? 'Subscribed' : 'Subscribe'} · {formatCount(followerCount)}
      </button>
      {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
