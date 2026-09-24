'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ContentItem as PlatformContent } from '@/lib/types';

export interface DiscoveryItem {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  type: 'image' | 'video';
  duration?: number;
  creator: {
    id: string;
    username: string;
    avatarUrl: string | null;
    isVerified: boolean;
    verificationTier: 'none' | 'bronze' | 'silver' | 'gold';
  };
  stats: {
    views: number;
    likes: number;
    rating: number;
  };
  aspectRatio: number;
  isPremium?: boolean;
  locked?: boolean;
  categories: string[];
}

interface MasonryGridProps {
  items: DiscoveryItem[];
  /** Must be the signed-in member's ageVerification flag. Media stays hidden until this is true. */
  ageVerified: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
}

function aspectFromId(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return 0.8 + (hash % 60) / 100;
}

function clampAspect(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1.2;
  return Math.min(1.6, Math.max(0.7, value));
}

export function toDiscoveryItem(item: PlatformContent): DiscoveryItem {
  return {
    id: item.id,
    title: item.title,
    thumbnailUrl: item.thumbnailUrl,
    type: item.mediaType === 'VIDEO' ? 'video' : 'image',
    creator: {
      id: item.creator.id,
      username: item.creator.username,
      avatarUrl: item.creator.avatarUrl,
      isVerified: item.creator.isVerified,
      verificationTier: 'none',
    },
    stats: {
      views: item.viewCount,
      likes: item.likeCount,
      rating: item.rating,
    },
    aspectRatio: aspectFromId(item.id),
    isPremium: item.isPremium,
    locked: item.locked,
    categories: item.tags,
  };
}

function formatNumber(num: number): string {
  if (!Number.isFinite(num)) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return Math.round(num).toString();
}

function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function distribute(items: DiscoveryItem[], columns: number): DiscoveryItem[][] {
  const count = Math.max(1, columns);
  const cols: DiscoveryItem[][] = Array.from({ length: count }, () => []);
  const heights = Array.from({ length: count }, () => 0);
  items.forEach((item) => {
    let target = 0;
    for (let index = 1; index < count; index += 1) {
      if (heights[index] < heights[target]) target = index;
    }
    cols[target].push(item);
    heights[target] += clampAspect(item.aspectRatio);
  });
  return cols;
}

function IconEye() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconHeart() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M20.8 8.6a5.5 5.5 0 0 0-9.3-3.9L12 6.2l.5-.5a5.5 5.5 0 0 0-9.3 3.9c0 6 9.3 10.4 9.3 10.4s8.3-4.4 8.3-10.4z" />
    </svg>
  );
}

function IconStar({ filled = false, className = '' }: { filled?: boolean; className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 16.8 6.6 19.8l1-6.1L3.2 9.4l6.1-.9L12 3z" />
    </svg>
  );
}

function IconPlay({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}

function IconVerified({ tier }: { tier: DiscoveryItem['creator']['verificationTier'] }) {
  const color =
    tier === 'gold' ? 'text-amber-400' : tier === 'silver' ? 'text-slate-300' : tier === 'bronze' ? 'text-orange-400' : 'text-blue-500';
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" className={color} fill="currentColor" aria-label="Verified">
      <path d="M12 2.5 14.4 5l3.2-.6.6 3.2 3 1.6-1.6 3 1.6 3-3 1.6-.6 3.2-3.2-.6L12 21.5 9.6 19l-3.2.6-.6-3.2L2.8 14.8l1.6-3-1.6-3 3-1.6.6-3.2L9.6 5 12 2.5z" />
      <path d="m8.2 12.2 2.4 2.4 5.2-5.4" fill="none" stroke="#09090b" strokeWidth="2" />
    </svg>
  );
}

function DiscoveryCard({ item }: { item: DiscoveryItem }) {
  const [loaded, setLoaded] = useState(false);
  const aspect = clampAspect(item.aspectRatio);
  const username = item.creator.username;
  const rating = Number.isFinite(item.stats.rating) ? item.stats.rating : 0;

  return (
    <article className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition-all duration-300 hover:border-zinc-700">
      <Link href={`/content/${item.id}`} className="block" aria-label={`${item.title} by @${username}`}>
        <div className="relative w-full overflow-hidden" style={{ paddingBottom: `${aspect * 100}%` }}>
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-950" aria-hidden="true" />
          {item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt=""
              draggable={false}
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
              onContextMenu={(event) => event.preventDefault()}
              className={`absolute inset-0 h-full w-full object-cover transition duration-500 ${
                item.locked
                  ? 'scale-105 blur-md'
                  : loaded
                    ? 'scale-100 blur-0 group-hover:scale-105'
                    : 'scale-105 blur-lg'
              }`}
            />
          ) : null}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
            <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
              {item.isPremium ? (
                <span className="rounded-full bg-amber-500/90 px-2 py-1 text-xs font-bold text-black">PREMIUM</span>
              ) : (
                <span />
              )}
              {item.type === 'video' ? (
                <span className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs text-white">
                  <IconPlay />
                  {item.duration != null ? formatDuration(item.duration) : 'Video'}
                </span>
              ) : null}
            </div>

            {item.type === 'video' ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-transform group-hover:scale-110">
                  <IconPlay size={32} className="ml-1 text-white" />
                </div>
              </div>
            ) : null}

            <div className="absolute inset-x-0 bottom-0 p-4">
              <h3 className="mb-2 line-clamp-2 text-sm font-semibold text-white">{item.title}</h3>
              <div className="mb-3 flex items-center gap-2">
                <span className="relative h-6 w-6 overflow-hidden rounded-full bg-zinc-700">
                  {item.creator.avatarUrl ? (
                    <img
                      src={item.creator.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      draggable={false}
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                </span>
                <span className="text-xs font-medium text-zinc-300">@{username}</span>
                {item.creator.isVerified ? <IconVerified tier={item.creator.verificationTier} /> : null}
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  <IconEye />
                  {formatNumber(item.stats.views)}
                </span>
                <span className="flex items-center gap-1">
                  <IconHeart />
                  {formatNumber(item.stats.likes)}
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <IconStar filled className="text-amber-400" />
                  {rating.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0 transition-opacity duration-300 group-hover:opacity-0 group-focus-within:opacity-0">
            {item.type === 'video' ? (
              <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-xs text-white">
                <IconPlay />
                {item.duration != null ? formatDuration(item.duration) : 'Video'}
              </div>
            ) : null}
            <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1">
              <IconStar filled className="text-amber-400" />
              <span className="text-xs font-bold text-white">{rating.toFixed(1)}</span>
            </div>
          </div>
        </div>
        <div className="px-3 py-2 sm:hidden">
          <h3 className="line-clamp-2 text-sm font-semibold text-zinc-100">{item.title}</h3>
          <p className="mt-1 text-xs text-zinc-400">@{username}</p>
        </div>
      </Link>
    </article>
  );
}

export function MasonryGrid({ items, ageVerified, onLoadMore, hasMore, loading }: MasonryGridProps) {
  const [columns, setColumns] = useState(3);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(Boolean(loading));
  loadingRef.current = Boolean(loading);

  useEffect(() => {
    const updateColumns = () => {
      if (window.innerWidth < 640) setColumns(1);
      else if (window.innerWidth < 1024) setColumns(2);
      else if (window.innerWidth < 1536) setColumns(3);
      else setColumns(4);
    };
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  useEffect(() => {
    if (ageVerified !== true || !hasMore || !onLoadMore) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingRef.current) onLoadMore();
      },
      { threshold: 0.1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ageVerified, hasMore, onLoadMore, items.length]);

  if (ageVerified !== true) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-12 text-center">
        <p className="text-lg font-semibold text-zinc-100">Adults 18+ only</p>
        <p className="mt-2 text-sm text-zinc-400">Confirm your age before browsing photos and videos.</p>
        <Link
          href="/age-verification?next=/discovery"
          className="mt-6 inline-flex rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white"
        >
          Verify your age
        </Link>
      </div>
    );
  }

  if (items.length === 0 && !loading) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-800 px-4 py-10 text-center text-zinc-400">Nothing here yet.</p>
    );
  }

  const columnData = distribute(items, columns);

  return (
    <div className="w-full">
      <div className="flex gap-4">
        {columnData.map((column, colIndex) => (
          <div key={colIndex} className="flex flex-1 flex-col gap-4">
            {column.map((item) => (
              <DiscoveryCard key={item.id} item={item} />
            ))}
          </div>
        ))}
      </div>
      {hasMore ? (
        <div ref={loadMoreRef} className="flex w-full justify-center py-8">
          {loading ? (
            <div className="flex items-center gap-2 text-zinc-500" role="status" aria-label="Loading more">
              <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:100ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:200ms]" />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type BrowseState = 'loading' | 'denied' | 'ready' | 'error';

export function DiscoveryPage() {
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [pageState, setPageState] = useState<BrowseState>('loading');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const readyRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/content?sort=newest&page=${pageRef.current}`);
      if (response.status === 401) {
        window.location.href = '/login?next=/discovery';
        return;
      }
      if (response.status === 403) {
        setItems([]);
        setHasMore(false);
        setPageState('denied');
        return;
      }
      const body = (await response.json()) as {
        items?: PlatformContent[];
        hasMore?: boolean;
        error?: string;
      };
      if (!response.ok || !body.items) throw new Error(body.error || 'Could not load discovery');
      setItems((current) => [...current, ...body.items!.map(toDiscoveryItem)]);
      pageRef.current += 1;
      setHasMore(body.items.length > 0 && Boolean(body.hasMore));
      readyRef.current = true;
      setPageState('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load discovery');
      setPageState(readyRef.current ? 'ready' : 'error');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMore();
  }, [loadMore]);

  if (pageState === 'loading' && items.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="aspect-[4/5] animate-pulse rounded-xl bg-zinc-900" />
        ))}
      </div>
    );
  }

  if (pageState === 'error' && items.length === 0) {
    return <p className="text-sm text-rose-300">{error || 'Could not load discovery'}</p>;
  }

  return (
    <div>
      <MasonryGrid
        items={pageState === 'ready' ? items : []}
        ageVerified={pageState === 'ready'}
        onLoadMore={loadMore}
        hasMore={pageState === 'ready' && hasMore}
        loading={loading}
      />
      {error && pageState === 'ready' ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
