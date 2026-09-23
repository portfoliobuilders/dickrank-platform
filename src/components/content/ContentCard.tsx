'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatCount } from '@/lib/format';
import type { ContentItem } from '@/lib/types';

export function ContentCard({ content }: { content: ContentItem }) {
  const [loaded, setLoaded] = useState(false);
  const creatorName = content.creator.displayName || content.creator.username;

  return (
    <article className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition duration-200 hover:-translate-y-0.5 hover:border-rose-900/80">
      <Link href={`/content/${content.id}`} className="relative block aspect-[4/5] overflow-hidden bg-zinc-950">
        <div
          className={`absolute inset-0 scale-110 bg-gradient-to-br from-zinc-700 to-zinc-900 blur-xl transition-opacity duration-500 ${loaded ? 'opacity-0' : 'opacity-100'}`}
          aria-hidden="true"
        />
        {content.thumbnailUrl ? (
          <img
            src={content.thumbnailUrl}
            alt=""
            draggable={false}
            onLoad={() => setLoaded(true)}
            onContextMenu={(event) => event.preventDefault()}
            className={`h-full w-full object-cover transition duration-500 ${content.locked ? 'scale-105 blur-md' : loaded ? 'scale-100 blur-0' : 'scale-105 blur-lg'}`}
          />
        ) : null}
        {content.isPremium ? (
          <span className="absolute left-2 top-2 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
            Premium
          </span>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-3 py-3 text-sm text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <span>Rating</span>
          <span className="font-semibold">{content.rating.toFixed(1)}</span>
        </div>
      </Link>
      <div className="space-y-1 p-3">
        <Link href={`/content/${content.id}`} className="line-clamp-1 font-medium text-zinc-100 hover:text-white">
          {content.title}
        </Link>
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <Link href={`/creator/${content.creator.username}`} className="truncate hover:text-zinc-200">
            {creatorName}
          </Link>
          <span>{formatCount(content.viewCount)} views</span>
        </div>
      </div>
    </article>
  );
}

export function ContentGrid({ items }: { items: ContentItem[] }) {
  if (items.length === 0) {
    return <p className="rounded-2xl border border-dashed border-zinc-800 px-4 py-10 text-center text-zinc-400">Nothing here yet.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <ContentCard key={item.id} content={item} />
      ))}
    </div>
  );
}
