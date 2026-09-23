"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function LikeButton({
  contentId,
  initialLiked,
  initialCount,
}: {
  contentId: string;
  initialLiked: boolean;
  initialCount: number;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (pending) return;
    const nextLiked = !liked;
    const previousLiked = liked;
    const previousCount = count;
    setLiked(nextLiked);
    setCount(previousCount + (nextLiked ? 1 : -1));
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/content/${contentId}/like`, { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as { liked?: boolean; likeCount?: number; error?: string };
      if (!response.ok || typeof body.liked !== "boolean" || typeof body.likeCount !== "number") {
        throw new Error(body.error || "Could not update like");
      }
      setLiked(body.liked);
      setCount(body.likeCount);
    } catch (caught) {
      setLiked(previousLiked);
      setCount(previousCount);
      setError(caught instanceof Error ? caught.message : "Could not update like");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button variant={liked ? "primary" : "secondary"} aria-pressed={liked} onClick={() => void toggle()}>
        {liked ? "Liked" : "Like"} · {count}
      </Button>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
