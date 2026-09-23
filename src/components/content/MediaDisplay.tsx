'use client';

import Link from 'next/link';
import { VideoPlayer } from '@/components/content/VideoPlayer';
import type { ContentItem } from '@/lib/types';

export function MediaDisplay({ content, userId }: { content: ContentItem; userId: string }) {
  if (content.locked) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center rounded-2xl border border-amber-900/60 bg-gradient-to-br from-zinc-950 to-rose-950/40 p-8 text-center">
        <p className="text-lg font-semibold text-amber-200">Premium post</p>
        <p className="mt-2 max-w-md text-sm text-zinc-300">
          Subscribe to @{content.creator.username} to unlock this post.
        </p>
        <Link
          href={`/creator/${content.creator.username}`}
          className="mt-4 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950"
        >
          View creator
        </Link>
      </div>
    );
  }

  if (content.mediaType === 'VIDEO' && content.mediaUrl) {
    return (
      <VideoPlayer
        src={content.mediaUrl}
        poster={content.thumbnailUrl}
        qualities={content.qualities}
        userId={userId}
      />
    );
  }

  if (content.mediaUrl) {
    return (
      <div className="overflow-hidden rounded-2xl bg-black" onContextMenu={(event) => event.preventDefault()}>
        <img
          src={content.mediaUrl}
          alt={content.title}
          draggable={false}
          className="mx-auto max-h-[80vh] w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className="flex aspect-video items-center justify-center rounded-2xl bg-zinc-900 text-zinc-400">
      Media is unavailable.
    </div>
  );
}
