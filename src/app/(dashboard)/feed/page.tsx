"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ContentCard } from "@/components/content/ContentCard";
import { ContentCardSkeleton } from "@/components/ui/Skeleton";
import type { ContentCardModel, ContentListResponse, FeedFilter } from "@/types";

const filters: Array<{ id: FeedFilter; label: string }> = [
  { id: "following", label: "Following" },
  { id: "popular", label: "Popular" },
  { id: "new", label: "New" },
  { id: "premium", label: "Premium" },
];

export default function FeedPage() {
  const [filter, setFilter] = useState<FeedFilter>("new");
  const [items, setItems] = useState<ContentCardModel[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const loadPage = useCallback(async (nextPage: number, nextFilter: FeedFilter, append: boolean) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        feed: nextFilter,
        page: String(nextPage),
        sort: nextFilter === "popular" ? "popular" : "newest",
      });
      const response = await fetch(`/api/content?${params.toString()}`);
      const body = (await response.json().catch(() => ({}))) as ContentListResponse & { error?: string };
      if (id !== requestId.current) return;
      if (!response.ok) throw new Error(body.error || "Could not load the feed");
      setItems((current) => (append ? [...current, ...body.items] : body.items));
      setPage(body.page);
      setHasMore(body.hasMore);
    } catch (caught) {
      if (id !== requestId.current) return;
      setError(caught instanceof Error ? caught.message : "Could not load the feed");
      if (!append) setItems([]);
      setHasMore(false);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(1, filter, false);
  }, [filter, loadPage]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasMore && !loading) {
        void loadPage(page + 1, filter, true);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [filter, hasMore, loadPage, loading, page]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Your feed</h1>
        <p className="mt-1 text-sm text-zinc-400">Posts from people you follow, plus what is new and popular.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Feed filters">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            className={`rounded-full px-4 py-2 text-sm ${filter === item.id ? "bg-white text-zinc-950" : "bg-white/10 text-zinc-200"}`}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          <p>{error}</p>
          <button type="button" className="mt-2 underline" onClick={() => void loadPage(1, filter, false)}>
            Try again
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {items.map((item) => (
          <ContentCard key={item.id} content={item} />
        ))}
        {loading
          ? Array.from({ length: items.length === 0 ? 6 : 3 }).map((_, index) => <ContentCardSkeleton key={index} />)
          : null}
      </div>
      {!loading && items.length === 0 && !error ? (
        <p className="text-zinc-400">
          {filter === "following" ? "Follow creators to fill this feed." : "Nothing here yet."}
        </p>
      ) : null}
      <div ref={sentinel} className="h-8" />
    </div>
  );
}
