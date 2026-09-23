import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "@/lib/audit";
import { PAGE_SIZE } from "@/lib/constants";
import {
  demoCreateContent,
  demoGetContent,
  demoListContent,
  demoRelated,
  demoSoftDelete,
  demoToggleLike,
  demoUpdateContent,
} from "@/lib/demo-store";
import { isDemoMode } from "@/lib/demo";
import { ServiceError } from "@/lib/errors";
import { containsProhibitedContent } from "@/lib/safety";
import type {
  ContentCardModel,
  ContentDetail,
  ContentListResponse,
  CreateContentInput,
  ListContentQuery,
  UpdateContentInput,
  Viewer,
} from "@/types";

const CARD_COLUMNS = `
  id, title, thumbnail_url, blur_data_url, is_premium, view_count, like_count, rating, media_type, status, creator_id, tags, category, created_at,
  creator:profiles(username, display_name)
`;

const DETAIL_COLUMNS = `
  id, creator_id, title, description, tags, category, media_url, media_type, thumbnail_url, blur_data_url,
  qualities, is_premium, like_count, view_count, rating, status, created_at,
  creator:profiles(id, username, display_name, avatar_url, is_verified, is_creator)
`;

type CreatorJoin = {
  id?: string;
  username: string;
  display_name: string | null;
  avatar_url?: string | null;
  is_verified?: boolean;
  is_creator?: boolean;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function emptyList(page: number): ContentListResponse {
  return { items: [], page, pageSize: PAGE_SIZE, total: 0, hasMore: false };
}

function mapCard(row: Record<string, unknown>): ContentCardModel {
  const creator = one(row.creator as CreatorJoin | CreatorJoin[] | null);
  return {
    id: String(row.id),
    title: String(row.title),
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    blurDataUrl: (row.blur_data_url as string | null) ?? null,
    isPremium: Boolean(row.is_premium),
    viewCount: Number(row.view_count ?? 0),
    likeCount: Number(row.like_count ?? 0),
    rating: row.rating == null ? null : Number(row.rating),
    mediaType: row.media_type === "video" ? "video" : "image",
    creatorName: creator?.display_name || creator?.username || "Creator",
    creatorUsername: creator?.username || "creator",
  };
}

function mapDetail(row: Record<string, unknown>, locked: boolean, liked: boolean): ContentDetail {
  const creator = one(row.creator as CreatorJoin | CreatorJoin[] | null);
  if (!creator?.username || !creator.id) throw new ServiceError(500, "Content is missing its creator");
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description ?? ""),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    category: (row.category as string | null) ?? null,
    mediaUrl: locked ? null : ((row.media_url as string | null) ?? null),
    mediaType: row.media_type === "video" ? "video" : "image",
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    blurDataUrl: (row.blur_data_url as string | null) ?? null,
    qualities: locked ? null : ((row.qualities as ContentDetail["qualities"]) ?? null),
    isPremium: Boolean(row.is_premium),
    likeCount: Number(row.like_count ?? 0),
    viewCount: Number(row.view_count ?? 0),
    rating: row.rating == null ? null : Number(row.rating),
    status: (row.status as ContentDetail["status"]) ?? "PUBLISHED",
    createdAt: String(row.created_at),
    locked,
    liked,
    creator: {
      id: creator.id,
      username: creator.username,
      displayName: creator.display_name,
      avatarUrl: creator.avatar_url ?? null,
      isVerified: Boolean(creator.is_verified),
      isCreator: Boolean(creator.is_creator),
    },
  };
}

async function profileIdForUsername(supabase: SupabaseClient, username: string) {
  const { data, error } = await supabase.rpc("profile_id_for_username", { p_username: username });
  if (error) throw new ServiceError(500, "Could not look up that creator");
  return (data as string | null) ?? null;
}

async function viewerFollows(supabase: SupabaseClient, viewerId: string) {
  const { data, error } = await supabase.from("follows").select("creator_id").eq("follower_id", viewerId);
  if (error) throw new ServiceError(500, "Could not load followed creators");
  return (data ?? []).map((row) => row.creator_id as string);
}

async function isSubscribed(supabase: SupabaseClient, viewerId: string, creatorId: string) {
  const { data, error } = await supabase
    .from("creator_subscriptions")
    .select("status")
    .eq("subscriber_id", viewerId)
    .eq("creator_id", creatorId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new ServiceError(500, "Could not check subscription");
  return Boolean(data);
}

function rejectProhibitedCopy(parts: Array<string | string[] | undefined>) {
  if (containsProhibitedContent(...parts)) {
    throw new ServiceError(400, "This content can't be posted");
  }
}

export async function listContent(
  supabase: SupabaseClient | null,
  viewer: Viewer,
  query: ListContentQuery,
): Promise<ContentListResponse> {
  if (isDemoMode()) return demoListContent(query);
  if (!supabase) throw new ServiceError(503, "Database is not configured");

  let creatorId: string | null = null;
  if (query.creator) {
    creatorId = await profileIdForUsername(supabase, query.creator);
    if (!creatorId) return emptyList(query.page);
  }

  let followed: string[] = [];
  if (query.feed === "following") {
    followed = await viewerFollows(supabase, viewer.id);
    if (followed.length === 0) return emptyList(query.page);
  }

  let request = supabase.from("content").select(CARD_COLUMNS, { count: "exact" }).eq("status", "PUBLISHED");
  if (query.category) request = request.eq("category", query.category);
  if (query.tags?.length) request = request.overlaps("tags", query.tags);
  if (creatorId) request = request.eq("creator_id", creatorId);
  if (query.feed === "premium") request = request.eq("is_premium", true);
  if (query.feed === "following") request = request.in("creator_id", followed);

  request =
    query.sort === "popular" || query.feed === "popular"
      ? request.order("like_count", { ascending: false }).order("created_at", { ascending: false })
      : request.order("created_at", { ascending: false });

  const from = (query.page - 1) * PAGE_SIZE;
  const { data, error, count } = await request.range(from, from + PAGE_SIZE - 1);
  if (error) throw new ServiceError(500, "Could not load content");

  const items = (data ?? []).map((row) => mapCard(row as Record<string, unknown>));
  const total = count ?? items.length;
  return {
    items,
    page: query.page,
    pageSize: PAGE_SIZE,
    total,
    hasMore: from + items.length < total,
  };
}

export async function getContent(
  supabase: SupabaseClient | null,
  viewer: Viewer,
  id: string,
): Promise<{ content: ContentDetail; related: ContentCardModel[] }> {
  if (isDemoMode()) {
    const content = demoGetContent(id, viewer.id);
    if (!content) throw new ServiceError(404, "Content not found");
    return { content, related: demoRelated(id) };
  }
  if (!supabase) throw new ServiceError(503, "Database is not configured");

  const { data, error } = await supabase.from("content").select(DETAIL_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new ServiceError(500, "Could not load content");
  if (!data) throw new ServiceError(404, "Content not found");

  const row = data as Record<string, unknown>;
  const status = String(row.status);
  const creatorId = String(row.creator_id);
  const isOwner = creatorId === viewer.id;
  if (status === "DELETED" && !isOwner) throw new ServiceError(404, "Content not found");
  if (status !== "PUBLISHED" && status !== "DELETED" && !isOwner) throw new ServiceError(404, "Content not found");

  const premium = Boolean(row.is_premium);
  const locked = premium && !isOwner ? !(await isSubscribed(supabase, viewer.id, creatorId)) : false;

  const { data: likeRow } = await supabase
    .from("content_likes")
    .select("content_id")
    .eq("content_id", id)
    .eq("user_id", viewer.id)
    .maybeSingle();

  if (!isOwner && status === "PUBLISHED") {
    await supabase.rpc("increment_content_view", { p_content_id: id });
    row.view_count = Number(row.view_count ?? 0) + 1;
  }

  const content = mapDetail(row, locked, Boolean(likeRow));
  const tags = content.tags;
  let relatedQuery = supabase
    .from("content")
    .select(CARD_COLUMNS)
    .eq("status", "PUBLISHED")
    .neq("id", id)
    .limit(8);

  relatedQuery = tags.length
    ? relatedQuery.or(`creator_id.eq.${creatorId},tags.ov.{${tags.join(",")}}`)
    : relatedQuery.eq("creator_id", creatorId);

  const { data: relatedRows } = await relatedQuery;
  return {
    content,
    related: (relatedRows ?? []).map((item) => mapCard(item as Record<string, unknown>)),
  };
}

export async function createContent(
  supabase: SupabaseClient | null,
  viewer: Viewer,
  input: CreateContentInput,
) {
  rejectProhibitedCopy([input.title, input.description, input.category, input.tags]);
  if (isDemoMode()) {
    const content = demoCreateContent(viewer, input);
    await writeAudit(null, {
      actorId: viewer.id,
      action: "content.create",
      entityType: "content",
      entityId: content.id,
      metadata: { category: input.category, mediaType: input.mediaType, isPremium: input.isPremium },
    });
    return content;
  }
  if (!supabase) throw new ServiceError(503, "Database is not configured");

  const { data, error } = await supabase
    .from("content")
    .insert({
      creator_id: viewer.id,
      title: input.title,
      description: input.description,
      tags: input.tags,
      category: input.category,
      media_url: input.mediaUrl,
      media_type: input.mediaType,
      thumbnail_url: input.thumbnailUrl ?? null,
      blur_data_url: input.blurDataUrl ?? null,
      qualities: input.qualities ?? null,
      is_premium: input.isPremium,
      status: "PUBLISHED",
    })
    .select(DETAIL_COLUMNS)
    .single();

  if (error || !data) throw new ServiceError(500, "Could not create content");

  const content = mapDetail(data as Record<string, unknown>, false, false);
  await writeAudit(supabase, {
    actorId: viewer.id,
    action: "content.create",
    entityType: "content",
    entityId: content.id,
    metadata: { category: input.category, mediaType: input.mediaType, isPremium: input.isPremium },
  });
  return content;
}

export async function updateContent(
  supabase: SupabaseClient | null,
  viewer: Viewer,
  id: string,
  input: UpdateContentInput,
) {
  rejectProhibitedCopy([input.title, input.description, input.category, input.tags]);
  if (isDemoMode()) {
    try {
      const content = demoUpdateContent(viewer, id, input);
      await writeAudit(null, {
        actorId: viewer.id,
        action: "content.update",
        entityType: "content",
        entityId: id,
        metadata: { fields: Object.keys(input) },
      });
      return content;
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status) throw new ServiceError(status, error instanceof Error ? error.message : "Could not update content");
      throw error;
    }
  }
  if (!supabase) throw new ServiceError(503, "Database is not configured");

  const { data: existing, error: existingError } = await supabase
    .from("content")
    .select("id, creator_id, status")
    .eq("id", id)
    .maybeSingle();
  if (existingError) throw new ServiceError(500, "Could not update content");
  if (!existing) throw new ServiceError(404, "Content not found");
  if (existing.creator_id !== viewer.id) throw new ServiceError(403, "Only the creator can edit this");
  if (existing.status === "DELETED") throw new ServiceError(409, "Deleted content cannot be edited");

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.tags !== undefined) patch.tags = input.tags;
  if (input.category !== undefined) patch.category = input.category;
  if (input.mediaUrl !== undefined) patch.media_url = input.mediaUrl;
  if (input.mediaType !== undefined) patch.media_type = input.mediaType;
  if (input.thumbnailUrl !== undefined) patch.thumbnail_url = input.thumbnailUrl;
  if (input.blurDataUrl !== undefined) patch.blur_data_url = input.blurDataUrl;
  if (input.isPremium !== undefined) patch.is_premium = input.isPremium;
  if (input.qualities !== undefined) patch.qualities = input.qualities;

  const { data, error } = await supabase
    .from("content")
    .update(patch)
    .eq("id", id)
    .eq("creator_id", viewer.id)
    .select(DETAIL_COLUMNS)
    .single();

  if (error || !data) throw new ServiceError(500, "Could not update content");

  await writeAudit(supabase, {
    actorId: viewer.id,
    action: "content.update",
    entityType: "content",
    entityId: id,
    metadata: { fields: Object.keys(input) },
  });

  const { data: likeRow } = await supabase
    .from("content_likes")
    .select("content_id")
    .eq("content_id", id)
    .eq("user_id", viewer.id)
    .maybeSingle();
  const row = data as Record<string, unknown>;
  const locked = Boolean(row.is_premium) ? false : false;
  return mapDetail(row, locked, Boolean(likeRow));
}

export async function softDeleteContent(supabase: SupabaseClient | null, viewer: Viewer, id: string) {
  if (isDemoMode()) {
    try {
      const result = demoSoftDelete(viewer, id);
      await writeAudit(null, {
        actorId: viewer.id,
        action: "content.delete",
        entityType: "content",
        entityId: id,
        metadata: { softDelete: true, status: "DELETED" },
      });
      return result;
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status) throw new ServiceError(status, error instanceof Error ? error.message : "Could not delete content");
      throw error;
    }
  }
  if (!supabase) throw new ServiceError(503, "Database is not configured");

  const { data: existing, error: existingError } = await supabase
    .from("content")
    .select("id, creator_id")
    .eq("id", id)
    .maybeSingle();
  if (existingError) throw new ServiceError(500, "Could not delete content");
  if (!existing) throw new ServiceError(404, "Content not found");
  if (existing.creator_id !== viewer.id) throw new ServiceError(403, "Only the creator can delete this");

  const { error } = await supabase
    .from("content")
    .update({ status: "DELETED" })
    .eq("id", id)
    .eq("creator_id", viewer.id);
  if (error) throw new ServiceError(500, "Could not delete content");

  await writeAudit(supabase, {
    actorId: viewer.id,
    action: "content.delete",
    entityType: "content",
    entityId: id,
    metadata: { softDelete: true, status: "DELETED" },
  });

  return { id, status: "DELETED" as const };
}

export async function toggleLike(supabase: SupabaseClient | null, viewer: Viewer, id: string) {
  if (isDemoMode()) {
    try {
      return demoToggleLike(viewer.id, id);
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status) throw new ServiceError(status, error instanceof Error ? error.message : "Could not update like");
      throw error;
    }
  }
  if (!supabase) throw new ServiceError(503, "Database is not configured");

  const { data, error } = await supabase.rpc("toggle_content_like", { p_content_id: id });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("not found")) throw new ServiceError(404, "Content not found");
    if (message.includes("age")) throw new ServiceError(403, "Age verification required");
    throw new ServiceError(500, "Could not update like");
  }

  const liked = Boolean((data as { liked?: boolean } | null)?.liked);
  const likeCount = Number((data as { likeCount?: number } | null)?.likeCount ?? 0);
  if (!Number.isFinite(likeCount)) throw new ServiceError(500, "Could not update like");
  return { liked, likeCount };
}

export async function reportContent(
  supabase: SupabaseClient | null,
  viewer: Viewer,
  id: string,
  reason: string,
  details?: string,
) {
  if (containsProhibitedContent(details)) {
    throw new ServiceError(400, "This report can't be submitted");
  }
  if (isDemoMode()) {
    const { demoReport } = await import("@/lib/demo-store");
    const result = (() => {
      try {
        return demoReport(id, reason, details);
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status) throw new ServiceError(status, error instanceof Error ? error.message : "Could not report content");
        throw error;
      }
    })();
    await writeAudit(null, {
      actorId: viewer.id,
      action: "content.report",
      entityType: "content",
      entityId: id,
      metadata: { reason, priority: reason === "underage" ? "high" : "normal" },
    });
    return result;
  }
  if (!supabase) throw new ServiceError(503, "Database is not configured");

  const { data: content, error: contentError } = await supabase
    .from("content")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (contentError) throw new ServiceError(500, "Could not report content");
  if (!content || content.status === "DELETED") throw new ServiceError(404, "Content not found");

  const { error } = await supabase.from("content_reports").insert({
    content_id: id,
    reporter_id: viewer.id,
    reason,
    details: details ?? null,
  });

  if (error) {
    if (error.code === "23505") return { ok: true, duplicate: true };
    throw new ServiceError(500, "Could not report content");
  }

  await writeAudit(supabase, {
    actorId: viewer.id,
    action: "content.report",
    entityType: "content",
    entityId: id,
    metadata: { reason, priority: reason === "underage" ? "high" : "normal" },
  });

  return { ok: true, duplicate: false };
}
