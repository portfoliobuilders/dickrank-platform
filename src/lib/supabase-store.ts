import { createServiceClient } from '@/lib/supabase/server';
import { decryptJson, encryptJson } from '@/lib/encryption';
import { ApiError } from '@/lib/errors';
import { DEFAULT_PREFERENCES, type ContentItem, type ProfilePreferences, type QualityOption, type ScheduleItem, type SessionUser } from '@/lib/types';
import type { ContentStore, ListContentParams } from '@/lib/store';

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
  schedule: ScheduleItem[] | null;
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
  media_type: 'IMAGE' | 'VIDEO';
  qualities: QualityOption[] | null;
  is_premium: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'DELETED';
  like_count: number;
  view_count: number;
  rating: number;
  created_at: string;
  users?: UserRow | UserRow[] | null;
}

function db() {
  return createServiceClient();
}

async function writeAudit(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  await db().from('audit_logs').insert({
    user_id: userId,
    action,
    entity,
    entity_id: entityId ?? null,
    metadata: metadata ?? null,
  });
}

function asUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    ageVerification: row.age_verification,
    isCreator: row.is_creator,
    authUserId: row.auth_user_id,
  };
}

function creatorFrom(row: UserRow) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isVerified: row.is_verified,
    isCreator: row.is_creator,
  };
}

function nestedUser(row: ContentRow): UserRow | null {
  if (!row.users) return null;
  return Array.isArray(row.users) ? row.users[0] ?? null : row.users;
}

async function isSubscribed(viewerId: string | null, creatorId: string): Promise<boolean> {
  if (!viewerId) return false;
  const { data } = await db()
    .from('subscriptions')
    .select('id')
    .eq('subscriber_id', viewerId)
    .eq('creator_id', creatorId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  return Boolean(data);
}

async function present(row: ContentRow, viewerId: string | null, creator?: UserRow | null): Promise<ContentItem> {
  const owner = creator ?? nestedUser(row);
  if (!owner) throw new ApiError(500, 'Creator missing');
  const locked = row.is_premium && viewerId !== row.creator_id && !(await isSubscribed(viewerId, row.creator_id));
  let likedByMe = false;
  if (viewerId) {
    const { data } = await db()
      .from('likes')
      .select('id')
      .eq('user_id', viewerId)
      .eq('content_id', row.id)
      .maybeSingle();
    likedByMe = Boolean(data);
  }
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags: row.tags ?? [],
    category: row.category,
    mediaUrl: locked ? null : row.media_url,
    thumbnailUrl: row.thumbnail_url,
    mediaType: row.media_type,
    qualities: locked ? null : row.qualities,
    isPremium: row.is_premium,
    status: row.status,
    likeCount: row.like_count,
    viewCount: row.view_count,
    rating: row.rating,
    createdAt: row.created_at,
    creator: creatorFrom(owner),
    likedByMe,
    locked,
  };
}

async function requireVerifiedUser(userId: string): Promise<UserRow> {
  const { data, error } = await db().from('users').select('*').eq('id', userId).maybeSingle();
  if (error || !data) throw new ApiError(404, 'Account not found');
  const user = data as UserRow;
  if (user.age_verification !== true) throw new ApiError(403, 'Age verification required');
  return user;
}

function parsePreferences(payload: string | null): ProfilePreferences {
  const decoded = decryptJson<Partial<ProfilePreferences>>(payload);
  return { ...DEFAULT_PREFERENCES, ...decoded, notificationEmail: decoded?.notificationEmail ?? '' };
}

export function createSupabaseStore(): ContentStore {
  return {
    async getUserById(id) {
      const { data } = await db().from('users').select('*').eq('id', id).maybeSingle();
      return data ? asUser(data as UserRow) : null;
    },

    async getUserByAuthId(authUserId) {
      const { data } = await db().from('users').select('*').eq('auth_user_id', authUserId).maybeSingle();
      return data ? asUser(data as UserRow) : null;
    },

    async confirmAge(userId) {
      const { data, error } = await db()
        .from('users')
        .update({ age_verification: true })
        .eq('id', userId)
        .select('*')
        .single();
      if (error || !data) throw new ApiError(404, 'Account not found');
      await writeAudit(userId, 'update', 'user', userId, { ageVerification: true });
      return asUser(data as UserRow);
    },

    async listContent(params: ListContentParams, viewerId) {
      let query = db()
        .from('content')
        .select('*, users(*)', { count: 'exact' })
        .eq('status', 'PUBLISHED');
      if (params.category) query = query.eq('category', params.category);
      if (params.premiumOnly) query = query.eq('is_premium', true);
      if (params.tags?.length) query = query.contains('tags', params.tags);
      if (params.creatorUsername) {
        const { data: creator } = await db()
          .from('users')
          .select('id')
          .eq('username', params.creatorUsername)
          .maybeSingle();
        query = creator ? query.eq('creator_id', creator.id) : query.eq('creator_id', '__none__');
      }
      if (params.followingOnly && viewerId) {
        const { data: follows } = await db().from('follows').select('following_id').eq('follower_id', viewerId);
        const { data: subs } = await db()
          .from('subscriptions')
          .select('creator_id')
          .eq('subscriber_id', viewerId)
          .eq('status', 'ACTIVE');
        const ids = [
          ...new Set([
            ...(follows ?? []).map((row) => row.following_id as string),
            ...(subs ?? []).map((row) => row.creator_id as string),
          ]),
        ];
        query = ids.length ? query.in('creator_id', ids) : query.eq('creator_id', '__none__');
      } else if (params.followingOnly) {
        query = query.eq('creator_id', '__none__');
      }
      query = params.sort === 'popular' ? query.order('like_count', { ascending: false }) : query.order('created_at', { ascending: false });
      const from = (params.page - 1) * params.pageSize;
      const to = from + params.pageSize - 1;
      const { data, error, count } = await query.range(from, to);
      if (error) throw new ApiError(500, 'Could not load content');
      const items = await Promise.all((data as ContentRow[] | null ?? []).map((row) => present(row, viewerId)));
      const total = count ?? items.length;
      return {
        items,
        page: params.page,
        pageSize: params.pageSize,
        total,
        hasMore: from + params.pageSize < total,
      };
    },

    async getContent(id, viewerId, options) {
      const { data, error } = await db().from('content').select('*, users(*)').eq('id', id).neq('status', 'DELETED').maybeSingle();
      if (error || !data) return null;
      if (options?.countView) {
        await db()
          .from('content')
          .update({ view_count: (data as ContentRow).view_count + 1 })
          .eq('id', id);
        (data as ContentRow).view_count += 1;
      }
      return present(data as ContentRow, viewerId);
    },

    async relatedContent(id, viewerId) {
      const current = await this.getContent(id, viewerId, { countView: false });
      if (!current) return [];
      const { data } = await db()
        .from('content')
        .select('*, users(*)')
        .eq('status', 'PUBLISHED')
        .neq('id', id)
        .or(`creator_id.eq.${current.creator.id},category.eq.${current.category ?? 'none'}`)
        .limit(6);
      return Promise.all((data as ContentRow[] | null ?? []).map((row) => present(row, viewerId)));
    },

    async createContent(userId, input) {
      const user = await requireVerifiedUser(userId);
      const { data, error } = await db()
        .from('content')
        .insert({
          creator_id: user.id,
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
        .select('*, users(*)')
        .single();
      if (error || !data) throw new ApiError(500, 'Could not create content');
      await db().from('users').update({ is_creator: true, content_count: user.content_count + 1 }).eq('id', user.id);
      await writeAudit(user.id, 'create', 'content', (data as ContentRow).id, { title: input.title });
      return present(data as ContentRow, user.id);
    },

    async updateContent(userId, id, input) {
      const user = await requireVerifiedUser(userId);
      const { data: existing } = await db().from('content').select('*').eq('id', id).neq('status', 'DELETED').maybeSingle();
      if (!existing) throw new ApiError(404, 'Content not found');
      if ((existing as ContentRow).creator_id !== user.id) throw new ApiError(403, 'You can only edit your own content');
      const patch: Record<string, unknown> = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.tags !== undefined) patch.tags = input.tags;
      if (input.category !== undefined) patch.category = input.category;
      if (input.thumbnailUrl !== undefined) patch.thumbnail_url = input.thumbnailUrl;
      if (input.isPremium !== undefined) patch.is_premium = input.isPremium;
      if (input.status !== undefined) patch.status = input.status;
      if (input.qualities !== undefined) patch.qualities = input.qualities;
      const { data, error } = await db().from('content').update(patch).eq('id', id).select('*, users(*)').single();
      if (error || !data) throw new ApiError(500, 'Could not update content');
      await writeAudit(user.id, 'update', 'content', id);
      return present(data as ContentRow, user.id);
    },

    async softDeleteContent(userId, id) {
      const user = await requireVerifiedUser(userId);
      const { data: existing } = await db().from('content').select('*').eq('id', id).neq('status', 'DELETED').maybeSingle();
      if (!existing) throw new ApiError(404, 'Content not found');
      if ((existing as ContentRow).creator_id !== user.id) throw new ApiError(403, 'You can only delete your own content');
      const { error } = await db().from('content').update({ status: 'DELETED' }).eq('id', id);
      if (error) throw new ApiError(500, 'Could not delete content');
      await writeAudit(user.id, 'delete', 'content', id, { status: 'DELETED' });
    },

    async toggleLike(userId, contentId) {
      await requireVerifiedUser(userId);
      const { data, error } = await db().rpc('toggle_content_like', { p_content_id: contentId, p_user_id: userId });
      if (error || !data) throw new ApiError(500, 'Could not update like');
      const result = data as { liked: boolean; likeCount: number };
      await writeAudit(userId, 'update', 'like', contentId, { liked: result.liked });
      return result;
    },

    async getCreator(username, viewerId) {
      const { data: user } = await db().from('users').select('*').eq('username', username).maybeSingle();
      if (!user) return null;
      const owner = user as UserRow;
      const { data } = await db()
        .from('content')
        .select('*, users(*)')
        .eq('creator_id', owner.id)
        .eq('status', 'PUBLISHED')
        .order('created_at', { ascending: false });
      const content = await Promise.all((data as ContentRow[] | null ?? []).map((row) => present(row, viewerId, owner)));
      return {
        id: owner.id,
        username: owner.username,
        displayName: owner.display_name,
        bio: owner.bio,
        location: owner.location,
        orientation: owner.orientation,
        interests: owner.interests ?? [],
        avatarUrl: owner.avatar_url,
        isCreator: owner.is_creator,
        isVerified: owner.is_verified,
        ageVerification: owner.age_verification,
        contentCount: owner.content_count,
        followerCount: owner.follower_count,
        subscribed: await isSubscribed(viewerId, owner.id),
        isSelf: viewerId === owner.id,
        schedule: owner.schedule ?? [],
        content,
      };
    },

    async getEditableProfile(userId) {
      const { data } = await db().from('users').select('*').eq('id', userId).maybeSingle();
      if (!data) return null;
      const user = data as UserRow;
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
        preferences: parsePreferences(user.preferences_enc),
      };
    },

    async updateProfile(userId, input) {
      const user = await requireVerifiedUser(userId);
      const { data, error } = await db()
        .from('users')
        .update({
          display_name: input.displayName,
          bio: input.bio,
          location: input.location,
          orientation: input.orientation,
          interests: input.interests,
          preferences_enc: encryptJson(input.preferences),
        })
        .eq('id', user.id)
        .select('*')
        .single();
      if (error || !data) throw new ApiError(500, 'Could not save profile');
      await writeAudit(user.id, 'update', 'profile', user.id, { fields: ['displayName', 'bio', 'preferences'] });
      const editable = await this.getEditableProfile(user.id);
      if (!editable) throw new ApiError(404, 'Profile not found');
      return editable;
    },

    async setAvatar(userId, avatarUrl) {
      const user = await requireVerifiedUser(userId);
      const { error } = await db().from('users').update({ avatar_url: avatarUrl }).eq('id', user.id);
      if (error) throw new ApiError(500, 'Could not save avatar');
      await writeAudit(user.id, 'upload', 'profile', user.id, { avatar: true });
      return avatarUrl;
    },

    async toggleSubscribe(userId, username) {
      const viewer = await requireVerifiedUser(userId);
      const { data: creatorRow } = await db().from('users').select('*').eq('username', username).maybeSingle();
      if (!creatorRow) throw new ApiError(404, 'Creator not found');
      const creator = creatorRow as UserRow;
      if (!creator.is_creator) throw new ApiError(400, 'This member is not a creator');
      if (creator.id === viewer.id) throw new ApiError(400, 'You cannot subscribe to yourself');
      const { data: existing } = await db()
        .from('subscriptions')
        .select('id')
        .eq('subscriber_id', viewer.id)
        .eq('creator_id', creator.id)
        .maybeSingle();
      if (existing) {
        await db().from('subscriptions').delete().eq('id', existing.id);
        await db().from('follows').delete().eq('follower_id', viewer.id).eq('following_id', creator.id);
        const nextCount = Math.max(0, creator.follower_count - 1);
        await db().from('users').update({ follower_count: nextCount }).eq('id', creator.id);
        await writeAudit(viewer.id, 'update', 'subscription', creator.id, { subscribed: false });
        return { subscribed: false, followerCount: nextCount };
      }
      await db().from('subscriptions').insert({ subscriber_id: viewer.id, creator_id: creator.id, status: 'ACTIVE' });
      await db().from('follows').upsert({ follower_id: viewer.id, following_id: creator.id });
      const nextCount = creator.follower_count + 1;
      await db().from('users').update({ follower_count: nextCount }).eq('id', creator.id);
      await writeAudit(viewer.id, 'create', 'subscription', creator.id, { subscribed: true });
      return { subscribed: true, followerCount: nextCount };
    },

    async reportContent(userId, contentId, reason, details) {
      await requireVerifiedUser(userId);
      const { data: existing } = await db()
        .from('reports')
        .select('id')
        .eq('reporter_id', userId)
        .eq('content_id', contentId)
        .maybeSingle();
      if (existing) return { alreadyReported: true };
      const { error } = await db().from('reports').insert({
        reporter_id: userId,
        content_id: contentId,
        reason,
        details: details ?? null,
      });
      if (error) throw new ApiError(500, 'Could not send report');
      await writeAudit(userId, 'create', 'report', contentId, { reason });
      return { alreadyReported: false };
    },
  };
}
