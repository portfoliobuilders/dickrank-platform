import { ApiError } from '@/lib/errors';
import { decryptJson, encryptJson } from '@/lib/encryption';
import { createServiceClient } from '@/lib/supabase/server';
import {
  DEFAULT_PREFERENCES,
  PAGE_SIZE,
  type ContentItem,
  type ContentStatus,
  type CreatorSummary,
  type MediaType,
  type ProfilePreferences,
  type PublicProfile,
  type QualityOption,
  type ScheduleItem,
  type SessionUser,
} from '@/lib/types';
import type { CreateContentInput, UpdateContentInput, UpdateProfileInput } from '@/lib/validators';
import type { ContentStore, ListContentParams } from '@/lib/data/types';

interface UserRow {
  id: string;
  auth_user_id: string | null;
  username: string;
  display_name: string | null;
  bio: string | null;
  location: string | null;
  orientation: string | null;
  interests: string[] | null;
  avatar_url: string | null;
  is_creator: boolean;
  is_verified: boolean;
  age_verification: boolean;
  content_count: number;
  follower_count: number;
  preferences_enc: string | null;
  schedule: unknown;
  created_at: string;
  updated_at: string;
}

interface ContentRow {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  category: string | null;
  media_url: string;
  thumbnail_url: string | null;
  media_type: MediaType;
  qualities: unknown;
  is_premium: boolean;
  status: ContentStatus;
  like_count: number;
  view_count: number;
  rating: number;
  created_at: string;
  updated_at: string;
}

const USER_PUBLIC =
  'id, auth_user_id, username, display_name, bio, location, orientation, interests, avatar_url, is_creator, is_verified, age_verification, content_count, follower_count, schedule, created_at, updated_at';

function fail(error: { message: string } | null, label: string): void {
  if (!error) return;
  console.error(label, error.message);
  throw new ApiError(500, 'Something went wrong');
}

function client() {
  return createServiceClient();
}

function asQualities(value: unknown): QualityOption[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.filter((item): item is QualityOption => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as QualityOption;
    return typeof candidate.label === 'string' && typeof candidate.url === 'string';
  });
  return items.length > 0 ? items : null;
}

function asSchedule(value: unknown): ScheduleItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as ScheduleItem;
    if (typeof candidate.title !== 'string' || typeof candidate.startsAt !== 'string') return [];
    return [{ id: candidate.id || candidate.startsAt, title: candidate.title, startsAt: candidate.startsAt }];
  });
}

function toSession(user: UserRow): SessionUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    ageVerification: user.age_verification === true,
    isCreator: user.is_creator,
    authUserId: user.auth_user_id,
  };
}

function toSummary(user: Pick<UserRow, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_verified' | 'is_creator'>): CreatorSummary {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    isVerified: user.is_verified,
    isCreator: user.is_creator,
  };
}

async function mustUser(id: string): Promise<UserRow> {
  const { data, error } = await client().from('users').select('*').eq('id', id).maybeSingle();
  fail(error, 'load user');
  if (!data) throw new ApiError(404, 'Profile not found');
  return data as UserRow;
}

async function userByUsername(username: string): Promise<UserRow | null> {
  const { data, error } = await client().from('users').select('*').eq('username', username).maybeSingle();
  fail(error, 'load username');
  return (data as UserRow | null) ?? null;
}

async function creatorsByIds(ids: string[]): Promise<Map<string, CreatorSummary>> {
  const map = new Map<string, CreatorSummary>();
  if (ids.length === 0) return map;
  const { data, error } = await client().from('users').select(USER_PUBLIC).in('id', ids);
  fail(error, 'load creators');
  for (const row of (data ?? []) as unknown as UserRow[]) map.set(row.id, toSummary(row));
  return map;
}

async function likedSet(viewerId: string | null, contentIds: string[]): Promise<Set<string>> {
  const liked = new Set<string>();
  if (!viewerId || contentIds.length === 0) return liked;
  const { data, error } = await client()
    .from('likes')
    .select('content_id')
    .eq('user_id', viewerId)
    .in('content_id', contentIds);
  fail(error, 'load likes');
  for (const row of (data ?? []) as { content_id: string }[]) liked.add(row.content_id);
  return liked;
}

async function subscribed(viewerId: string | null, creatorId: string): Promise<boolean> {
  if (!viewerId || viewerId === creatorId) return false;
  const { data, error } = await client()
    .from('subscriptions')
    .select('id')
    .eq('subscriber_id', viewerId)
    .eq('creator_id', creatorId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  fail(error, 'load subscription');
  return Boolean(data);
}

function present(
  row: ContentRow,
  creator: CreatorSummary,
  viewerId: string | null,
  liked: boolean,
  locked: boolean,
  detail: boolean,
): ContentItem {
  const hideMedia = !detail || locked;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags: row.tags ?? [],
    category: row.category,
    mediaUrl: hideMedia ? null : row.media_url,
    thumbnailUrl: row.thumbnail_url,
    mediaType: row.media_type,
    qualities: hideMedia ? null : asQualities(row.qualities),
    isPremium: row.is_premium,
    status: row.status,
    likeCount: row.like_count,
    viewCount: row.view_count,
    rating: row.rating,
    createdAt: row.created_at,
    creator,
    likedByMe: liked,
    locked,
  };
}

async function audit(entry: {
  userId: string | null;
  action: 'create' | 'update' | 'delete' | 'upload';
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await client()
    .from('audit_logs')
    .insert({
      id: crypto.randomUUID(),
      user_id: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
    });
  fail(error, 'audit log');
}

function preferencesOf(user: UserRow): ProfilePreferences {
  return decryptJson<ProfilePreferences>(user.preferences_enc) ?? DEFAULT_PREFERENCES;
}

function toEditable(user: UserRow) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    bio: user.bio,
    location: user.location,
    orientation: user.orientation,
    interests: user.interests ?? [],
    avatarUrl: user.avatar_url,
    isCreator: user.is_creator,
    preferences: preferencesOf(user),
  };
}

async function toPublic(user: UserRow, viewerId: string | null): Promise<PublicProfile> {
  const listed = await listRows({ creatorUsername: user.username, sort: 'newest', page: 1, pageSize: 24 }, viewerId);
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    bio: user.bio,
    location: user.location,
    orientation: user.orientation,
    interests: user.interests ?? [],
    avatarUrl: user.avatar_url,
    isCreator: user.is_creator,
    isVerified: user.is_verified,
    ageVerification: user.age_verification === true,
    contentCount: user.content_count,
    followerCount: user.follower_count,
    subscribed: await subscribed(viewerId, user.id),
    isSelf: viewerId === user.id,
    schedule: asSchedule(user.schedule),
    content: listed.items,
  };
}

async function listRows(params: ListContentParams, viewerId: string | null) {
  const pageSize = Math.min(Math.max(params.pageSize || PAGE_SIZE, 1), 24);
  const page = Math.max(params.page, 1);
  const service = client();

  if (params.followingOnly && !viewerId) {
    return { items: [], page, pageSize, total: 0, hasMore: false };
  }

  let followingIds: string[] | null = null;
  if (params.followingOnly && viewerId) {
    const { data, error } = await service.from('follows').select('following_id').eq('follower_id', viewerId);
    fail(error, 'load follows');
    followingIds = ((data ?? []) as { following_id: string }[]).map((row) => row.following_id);
    if (followingIds.length === 0) return { items: [], page, pageSize, total: 0, hasMore: false };
  }

  let creatorId: string | null = null;
  if (params.creatorUsername) {
    const creator = await userByUsername(params.creatorUsername);
    if (!creator) return { items: [], page, pageSize, total: 0, hasMore: false };
    creatorId = creator.id;
  }

  let query = service.from('content').select('*', { count: 'exact' }).eq('status', 'PUBLISHED');
  if (params.category) query = query.eq('category', params.category);
  if (params.tags && params.tags.length > 0) query = query.contains('tags', params.tags);
  if (params.premiumOnly) query = query.eq('is_premium', true);
  if (creatorId) query = query.eq('creator_id', creatorId);
  if (followingIds) query = query.in('creator_id', followingIds);
  query =
    params.sort === 'popular'
      ? query.order('like_count', { ascending: false }).order('created_at', { ascending: false })
      : query.order('created_at', { ascending: false });

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  fail(error, 'list content');
  const rows = (data ?? []) as ContentRow[];
  const creators = await creatorsByIds([...new Set(rows.map((row) => row.creator_id))]);
  const likes = await likedSet(viewerId, rows.map((row) => row.id));
  const items = rows.flatMap((row) => {
    const creator = creators.get(row.creator_id);
    if (!creator) return [];
    const locked = row.is_premium && viewerId !== row.creator_id;
    return [present(row, creator, viewerId, likes.has(row.id), locked, false)];
  });

  if (viewerId) {
    const premiumCreatorIds = [...new Set(rows.filter((row) => row.is_premium).map((row) => row.creator_id))];
    if (premiumCreatorIds.length > 0) {
      const { data: subs, error: subError } = await service
        .from('subscriptions')
        .select('creator_id')
        .eq('subscriber_id', viewerId)
        .eq('status', 'ACTIVE')
        .in('creator_id', premiumCreatorIds);
      fail(subError, 'load premium access');
      const open = new Set(((subs ?? []) as { creator_id: string }[]).map((row) => row.creator_id));
      for (const item of items) {
        if (item.isPremium && (item.creator.id === viewerId || open.has(item.creator.id))) {
          item.locked = false;
        }
      }
    }
  }

  const total = count ?? rows.length;
  return { items, page, pageSize, total, hasMore: from + pageSize < total };
}

export function createSupabaseStore(): ContentStore {
  return {
    async getUserById(id) {
      const { data, error } = await client().from('users').select(USER_PUBLIC).eq('id', id).maybeSingle();
      fail(error, 'get user');
      return data ? toSession(data as unknown as UserRow) : null;
    },
    async getUserByAuthId(authUserId) {
      const { data, error } = await client()
        .from('users')
        .select(USER_PUBLIC)
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      fail(error, 'get auth user');
      return data ? toSession(data as unknown as UserRow) : null;
    },
    async confirmAge(userId) {
      const user = await mustUser(userId);
      if (user.age_verification !== true) {
        const { error } = await client().from('users').update({ age_verification: true }).eq('id', userId);
        fail(error, 'confirm age');
        await audit({ userId, action: 'update', entity: 'user', entityId: userId, metadata: { ageVerification: true } });
        user.age_verification = true;
      }
      return toSession(user);
    },
    listContent: listRows,
    async getContent(id, viewerId, options) {
      const { data, error } = await client().from('content').select('*').eq('id', id).maybeSingle();
      fail(error, 'get content');
      const row = data as ContentRow | null;
      if (!row || row.status === 'DELETED') return null;
      if (row.status !== 'PUBLISHED' && row.creator_id !== viewerId) return null;
      if (options?.countView !== false && row.status === 'PUBLISHED') {
        const { error: viewError } = await client()
          .from('content')
          .update({ view_count: row.view_count + 1 })
          .eq('id', id);
        fail(viewError, 'count view');
        row.view_count += 1;
      }
      const creators = await creatorsByIds([row.creator_id]);
      const creator = creators.get(row.creator_id);
      if (!creator) throw new ApiError(404, 'Creator not found');
      const likes = await likedSet(viewerId, [row.id]);
      const locked = row.is_premium && viewerId !== row.creator_id && !(await subscribed(viewerId, row.creator_id));
      return present(row, creator, viewerId, likes.has(row.id), locked, true);
    },
    async relatedContent(id, viewerId) {
      const current = await this.getContent(id, viewerId, { countView: false });
      if (!current) return [];
      const { data, error } = await client()
        .from('content')
        .select('*')
        .eq('status', 'PUBLISHED')
        .neq('id', id)
        .order('created_at', { ascending: false })
        .limit(24);
      fail(error, 'related content');
      const rows = (data ?? []) as ContentRow[];
      const creators = await creatorsByIds([...new Set(rows.map((row) => row.creator_id))]);
      const likes = await likedSet(
        viewerId,
        rows.map((row) => row.id),
      );
      return rows
        .map((row) => ({
          row,
          score:
            (row.tags ?? []).filter((tag) => current.tags.includes(tag)).length +
            (row.category && row.category === current.category ? 2 : 0),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .flatMap(({ row }) => {
          const creator = creators.get(row.creator_id);
          if (!creator) return [];
          const locked = row.is_premium && viewerId !== row.creator_id;
          return [present(row, creator, viewerId, likes.has(row.id), locked, false)];
        });
    },
    async createContent(userId, input: CreateContentInput) {
      const user = await mustUser(userId);
      if (user.age_verification !== true) throw new ApiError(403, 'Age verification required');
      const id = crypto.randomUUID();
      const { data, error } = await client()
        .from('content')
        .insert({
          id,
          creator_id: userId,
          title: input.title,
          description: input.description ?? null,
          tags: input.tags,
          category: input.category ?? null,
          media_url: input.mediaUrl,
          thumbnail_url: input.thumbnailUrl ?? null,
          media_type: input.mediaType,
          qualities: input.qualities ?? null,
          is_premium: input.isPremium,
          status: input.status,
          rating: input.rating ?? 0,
        })
        .select('*')
        .single();
      fail(error, 'create content');
      const publishedBump = input.status === 'PUBLISHED' ? 1 : 0;
      const { error: userError } = await client()
        .from('users')
        .update({ is_creator: true, content_count: user.content_count + publishedBump })
        .eq('id', userId);
      fail(userError, 'update creator counts');
      await audit({ userId, action: 'create', entity: 'content', entityId: id });
      const row = data as ContentRow;
      return present(row, toSummary({ ...user, is_creator: true }), userId, false, false, true);
    },
    async updateContent(userId, id, input: UpdateContentInput) {
      const { data: existing, error: loadError } = await client().from('content').select('*').eq('id', id).maybeSingle();
      fail(loadError, 'load content for update');
      const current = existing as ContentRow | null;
      if (!current || current.status === 'DELETED') throw new ApiError(404, 'Content not found');
      if (current.creator_id !== userId) throw new ApiError(403, 'You can only edit your own content');
      const patch: Record<string, unknown> = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.tags !== undefined) patch.tags = input.tags;
      if (input.category !== undefined) patch.category = input.category;
      if (input.thumbnailUrl !== undefined) patch.thumbnail_url = input.thumbnailUrl;
      if (input.isPremium !== undefined) patch.is_premium = input.isPremium;
      if (input.status !== undefined) patch.status = input.status;
      if (input.qualities !== undefined) patch.qualities = input.qualities;
      const { data, error } = await client().from('content').update(patch).eq('id', id).select('*').single();
      fail(error, 'update content');
      await audit({ userId, action: 'update', entity: 'content', entityId: id });
      const creators = await creatorsByIds([userId]);
      const creator = creators.get(userId);
      if (!creator) throw new ApiError(404, 'Creator not found');
      return present(data as ContentRow, creator, userId, false, false, true);
    },
    async softDeleteContent(userId, id) {
      const { data: existing, error: loadError } = await client().from('content').select('*').eq('id', id).maybeSingle();
      fail(loadError, 'load content for delete');
      const current = existing as ContentRow | null;
      if (!current || current.status === 'DELETED') throw new ApiError(404, 'Content not found');
      if (current.creator_id !== userId) throw new ApiError(403, 'You can only delete your own content');
      const { error } = await client().from('content').update({ status: 'DELETED' }).eq('id', id);
      fail(error, 'soft delete');
      if (current.status === 'PUBLISHED') {
        const user = await mustUser(userId);
        const { error: countError } = await client()
          .from('users')
          .update({ content_count: Math.max(0, user.content_count - 1) })
          .eq('id', userId);
        fail(countError, 'decrement content count');
      }
      await audit({ userId, action: 'delete', entity: 'content', entityId: id, metadata: { status: 'DELETED' } });
    },
    async toggleLike(userId, contentId) {
      await mustUser(userId);
      const { data: existingContent, error: contentError } = await client()
        .from('content')
        .select('*')
        .eq('id', contentId)
        .eq('status', 'PUBLISHED')
        .maybeSingle();
      fail(contentError, 'load like target');
      if (!existingContent) throw new ApiError(404, 'Content not found');
      const service = client();
      const { data: existingLike, error: likeError } = await service
        .from('likes')
        .select('id')
        .eq('user_id', userId)
        .eq('content_id', contentId)
        .maybeSingle();
      fail(likeError, 'load like');
      let liked: boolean;
      if (existingLike) {
        const { error } = await service.from('likes').delete().eq('id', (existingLike as { id: string }).id);
        fail(error, 'remove like');
        liked = false;
      } else {
        const { error } = await service.from('likes').insert({
          id: crypto.randomUUID(),
          user_id: userId,
          content_id: contentId,
        });
        fail(error, 'add like');
        liked = true;
      }
      const { count, error: countError } = await service
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('content_id', contentId);
      fail(countError, 'count likes');
      const likeCount = count ?? 0;
      const { error: updateError } = await service.from('content').update({ like_count: likeCount }).eq('id', contentId);
      fail(updateError, 'update like count');
      await audit({ userId, action: 'update', entity: 'content', entityId: contentId, metadata: { liked } });
      return { liked, likeCount };
    },
    async getCreator(username, viewerId) {
      const user = await userByUsername(username);
      if (!user) return null;
      return toPublic(user, viewerId);
    },
    async getEditableProfile(userId) {
      return toEditable(await mustUser(userId));
    },
    async updateProfile(userId, input: UpdateProfileInput) {
      const { data, error } = await client()
        .from('users')
        .update({
          display_name: input.displayName,
          bio: input.bio || null,
          location: input.location || null,
          orientation: input.orientation,
          interests: input.interests,
          preferences_enc: encryptJson(input.preferences),
        })
        .eq('id', userId)
        .select('*')
        .single();
      fail(error, 'update profile');
      await audit({
        userId,
        action: 'update',
        entity: 'user',
        entityId: userId,
        metadata: { fields: ['displayName', 'bio', 'location', 'orientation', 'interests', 'preferences'] },
      });
      return toEditable(data as UserRow);
    },
    async setAvatar(userId, avatarUrl) {
      const { error } = await client().from('users').update({ avatar_url: avatarUrl }).eq('id', userId);
      fail(error, 'set avatar');
      await audit({ userId, action: 'upload', entity: 'user', entityId: userId, metadata: { field: 'avatar' } });
      return avatarUrl;
    },
    async toggleSubscribe(userId, username) {
      const viewer = await mustUser(userId);
      const creator = await userByUsername(username);
      if (!creator) throw new ApiError(404, 'Creator not found');
      if (!creator.is_creator) throw new ApiError(400, 'This member is not a creator');
      if (creator.id === viewer.id) throw new ApiError(400, 'You cannot subscribe to yourself');
      const service = client();
      const { data: existing, error: loadError } = await service
        .from('subscriptions')
        .select('id')
        .eq('subscriber_id', viewer.id)
        .eq('creator_id', creator.id)
        .maybeSingle();
      fail(loadError, 'load subscription toggle');
      if (existing) {
        const { error } = await service.from('subscriptions').delete().eq('id', (existing as { id: string }).id);
        fail(error, 'remove subscription');
        const { error: followError } = await service
          .from('follows')
          .delete()
          .eq('follower_id', viewer.id)
          .eq('following_id', creator.id);
        fail(followError, 'remove follow');
        const followerCount = Math.max(0, creator.follower_count - 1);
        const { error: countError } = await service.from('users').update({ follower_count: followerCount }).eq('id', creator.id);
        fail(countError, 'decrement followers');
        await audit({ userId, action: 'delete', entity: 'subscription', entityId: creator.id });
        return { subscribed: false, followerCount };
      }
      const { error } = await service.from('subscriptions').insert({
        id: crypto.randomUUID(),
        subscriber_id: viewer.id,
        creator_id: creator.id,
        status: 'ACTIVE',
      });
      fail(error, 'create subscription');
      const { error: followError } = await service.from('follows').insert({
        id: crypto.randomUUID(),
        follower_id: viewer.id,
        following_id: creator.id,
      });
      fail(followError, 'create follow');
      const followerCount = creator.follower_count + 1;
      const { error: countError } = await service.from('users').update({ follower_count: followerCount }).eq('id', creator.id);
      fail(countError, 'increment followers');
      await audit({ userId, action: 'create', entity: 'subscription', entityId: creator.id });
      return { subscribed: true, followerCount };
    },
    async reportContent(userId, contentId, reason, details) {
      const { data: content, error: contentError } = await client()
        .from('content')
        .select('id')
        .eq('id', contentId)
        .eq('status', 'PUBLISHED')
        .maybeSingle();
      fail(contentError, 'load report target');
      if (!content) throw new ApiError(404, 'Content not found');
      const { data: existing, error: existingError } = await client()
        .from('reports')
        .select('id')
        .eq('reporter_id', userId)
        .eq('content_id', contentId)
        .maybeSingle();
      fail(existingError, 'load report');
      if (existing) return { alreadyReported: true };
      const { error } = await client().from('reports').insert({
        id: crypto.randomUUID(),
        reporter_id: userId,
        content_id: contentId,
        reason,
        details: details ?? null,
      });
      fail(error, 'create report');
      await audit({ userId, action: 'create', entity: 'report', entityId: contentId, metadata: { reason } });
      return { alreadyReported: false };
    },
  };
}
