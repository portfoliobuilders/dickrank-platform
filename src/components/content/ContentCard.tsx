"use client";

import Link from "next/link";
import { useState } from "react";
import type { ContentCardModel } from "@/types";

function formatCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}

export function ContentCard({ content }: { content: ContentCardModel }) {
  const [loaded, setLoaded] = useState(false);
  const href = `/content/${content.id}`;

  return (
    <Link
      href={href}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 transition hover:-translate-y-0.5 hover:border-white/20"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-zinc-800">
        {content.blurDataUrl ? (
          // Decorative stand-in while the thumbnail loads.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={content.blurDataUrl}
            alt=""
            className={`absolute inset-0 h-full w-full scale-110 object-cover blur-2xl transition-opacity ${loaded ? "opacity-0" : "opacity-100"}`}
          />
        ) : null}
        {content.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={content.thumbnailUrl}
            alt=""
            onLoad={() => setLoaded(true)}
            className={`h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            {content.mediaType === "video" ? "Video" : "Photo"}
          </div>
        )}
        {content.isPremium ? (
          <span className="absolute right-3 top-3 rounded-full bg-amber-400 px-2 py-1 text-xs font-semibold text-zinc-950">
            Premium
          </span>
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
          <p className="text-sm font-medium text-white">
            {content.rating != null ? `${content.rating.toFixed(1)} rating` : "No rating yet"}
          </p>
        </div>
      </div>
      <div className="space-y-1 p-3">
        <h3 className="truncate font-medium text-white">{content.title}</h3>
        <p className="truncate text-sm text-zinc-400">
          {content.creatorName} · {formatCount(content.viewCount)} views
        </p>
      </div>
    </Link>
  );
}
