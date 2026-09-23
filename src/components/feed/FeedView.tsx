'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ContentGrid } from '@/components/content/ContentCard';
import { ContentGridSkeleton } from '@/components/ui/Skeleton';
import type { ContentItem, FeedFilter } from '@/lib/types';

const FILTERS: Array<{ id: FeedFilter; label: string }> = [
  { id: 'following', label: 'Following' },
  { id: 'popular', label: 'Popular' },
  { id: 'new', label: 'New' },
  { id: 'premium', label: 'Premium' },
];

export function FeedView({ initialFilter }: { initialFilter: FeedFilter }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FeedFilter>(initialFilter);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const filterRef = useRef(initialFilter);

  async function load(nextPage: number, nextFilter: FeedFilter, replace: boolean) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/content?filter=${nextFilter}&page=${nextPage}`);
      const body = (await response.json()) as {
        items?: ContentItem[];
        hasMore?: boolean;
        error?: string;
      };
      if (response.status === 401 || response.status === 403) {
        window.location.href = '/age-verification?next=/feed';
        return;
      }
      if (!response.ok || !body.items) throw new Error(body.error || 'Could not load the feed');
      if (filterRef.current !== nextFilter) return;
      setItems((current) => (replace ? body.items! : [...current, ...body.items!]));
      const more = Boolean(body.hasMore);
      hasMoreRef.current = more;
      pageRef.current = nextPage;
      setHasMore(more);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the feed');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    filterRef.current = filter;
    pageRef.current = 1;
    hasMoreRef.current = true;
    setItems([]);
    setHasMore(true);
    void load(1, filter, true);
    // load is stable enough for this screen; filter is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      if (!hasMoreRef.current || loadingRef.current) return;
      void load(pageRef.current + 1, filterRef.current, false);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [items.length, filter]);

  function choose(next: FeedFilter) {
    setFilter(next);
    router.replace(`/feed?filter=${next}`, { scroll: false });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Feed filters">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            onClick={() => choose(item.id)}
            className={`rounded-full px-4 py-2 text-sm ${filter === item.id ? 'bg-rose-600 text-white' : 'bg-zinc-900 text-zinc-300'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {loading && items.length === 0 ? <ContentGridSkeleton /> : <ContentGrid items={items} />}
      {loading && items.length > 0 ? (
        <div className="mt-4">
          <ContentGridSkeleton count={4} />
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      {!loading && items.length === 0 && filter === 'following' ? (
        <p className="mt-4 text-sm text-zinc-400">Subscribe to a creator and their posts will show up here.</p>
      ) : null}
      <div ref={sentinelRef} className="h-8" aria-hidden="true" />
      {hasMore ? <span className="sr-only">Loading more posts</span> : null}
    </div>
  );
}
