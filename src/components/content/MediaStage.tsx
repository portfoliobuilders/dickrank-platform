'use client';

import Link from 'next/link';
import type { ContentItem } from '@/lib/types';
import { VideoPlayer } from '@/components/content/VideoPlayer';

export function MediaStage({ content, userId }: { content: ContentItem; userId: string }) {
  if (content.locked || !content.mediaUrl) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-zinc-900">
        {content.thumbnailUrl ? (
          <img src={content.thumbnailUrl} alt="" className="aspect-video w-full object-cover blur-2xl" draggable={false} />
        ) : (
          <div className="aspect-video w-full bg-zinc-800" />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 px-6 text-center">
          <p className="text-lg font-medium">Subscribe to view this set</p>
          <Link
            href={`/creator/${content.creator.username}`}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white"
          >
            View creator
          </Link>
        </div>
      </div>
    );
  }

  if (content.mediaType === 'VIDEO') {
    return (
      <VideoPlayer
        src={content.mediaUrl}
        poster={content.thumbnailUrl}
        qualities={content.qualities}
        userId={userId}
      />
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black" onContextMenu={(event) => event.preventDefault()}>
      <img
        src={content.mediaUrl}
        alt={content.title}
        draggable={false}
        onContextMenu={(event) => event.preventDefault()}
        className="max-h-[70vh] w-full object-contain"
      />
      <div className="pointer-events-none absolute bottom-3 right-3 rounded bg-black/50 px-2 py-1 text-xs text-white/80">
        ID {userId}
      </div>
    </div>
  );
}
