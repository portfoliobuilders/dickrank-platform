'use client';

import { useState } from 'react';
import { formatCount } from '@/lib/format';

interface LikeButtonProps {
  contentId: string;
  initialLiked: boolean;
  initialCount: number;
}

export function LikeButton({ contentId, initialLiked, initialCount }: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    if (pending) return;
    const previous = { liked, count };
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((value) => Math.max(0, value + (nextLiked ? 1 : -1)));
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/content/${contentId}/like`, { method: 'POST' });
      const body = (await response.json()) as { liked?: boolean; likeCount?: number; error?: string };
      if (response.status === 401 || response.status === 403) {
        window.location.href = '/verify-age?next=/feed';
        return;
      }
      if (!response.ok || typeof body.liked !== 'boolean' || typeof body.likeCount !== 'number') {
        throw new Error(body.error || 'Could not update like');
      }
      setLiked(body.liked);
      setCount(body.likeCount);
    } catch (cause) {
      setLiked(previous.liked);
      setCount(previous.count);
      setError(cause instanceof Error ? cause.message : 'Could not update like');
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void toggle()}
        aria-pressed={liked}
        className={`rounded-full px-4 py-2 text-sm font-medium transition ${
          liked ? 'bg-rose-600 text-white' : 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
        }`}
      >
        {liked ? 'Liked' : 'Like'} · {formatCount(count)}
      </button>
      {error ? <p className="mt-1 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
