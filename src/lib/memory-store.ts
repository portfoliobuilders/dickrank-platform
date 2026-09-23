import { ApiError } from '@/lib/errors';
import { decryptJson, encryptJson } from '@/lib/encryption';
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
import type { AuditAction, AuditEntry, ContentStore, ListContentParams } from '@/lib/store';

interface MemoryUser {
  id: string;
  authUserId: string | null;
  username: string;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  orientation: string | null;
  interests: string[];
  avatarUrl: string | null;
  isCreator: boolean;
  isVerified: boolean;
  ageVerification: boolean;
  followerBase: number;
  preferencesEnc: string | null;
  schedule: ScheduleItem[];
  createdAt: string;
  updatedAt: string;
}

interface MemoryContent {
  id: string;
  creatorId: string;
  title: string;
  description: string | null;
  tags: string[];
  category: string | null;
  mediaUrl: string;
  thumbnailUrl: string | null;
  mediaType: MediaType;
  qualities: QualityOption[] | null;
  isPremium: boolean;
  status: ContentStatus;
  likeCount: number;
  viewCount: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

interface MemoryState {
  users: Map<string, MemoryUser>;
  content: MemoryContent[];
  likes: Array<{ id: string; userId: string; contentId: string }>;
  follows: Array<{ id: string; followerId: string; followingId: string }>;
  subscriptions: Array<{ id: string; subscriberId: string; creatorId: string; status: 'ACTIVE' }>;
  audits: AuditEntry[];
  reports: Array<{ id: string; reporterId: string; contentId: string; reason: string; details?: string }>;
}

const GLOBAL_KEY = '__dickrankMemoryStore';

function svgThumb(from: string, to: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="52%" fill="white" font-size="42" font-family="sans-serif" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function avatar(letter: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="100%" height="100%" rx="80" fill="${color}"/><text x="50%" y="58%" fill="white" font-size="72" font-family="sans-serif" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SAMPLE_480 = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
const SAMPLE_1080 = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4';

function seed(): MemoryState {
  const now = new Date('2026-09-20T12:00:00.000Z').getTime();
  const preferencesEnc = encryptJson(DEFAULT_PREFERENCES);

  const alex: MemoryUser = {
    id: 'usr_alex',
    authUserId: null,
    username: 'alexrivera',
    displayName: 'Alex Rivera',
    bio: 'Photographer and performer. New studio sets every week.',
    location: 'Los Angeles',
    orientation: 'queer',
    interests: ['photography', 'live sessions', 'studio lighting'],
    avatarUrl: avatar('A', '#be123c'),
    isCreator: true,
    isVerified: true,
    ageVerification: true,
    followerBase: 1280,
    preferencesEnc,
    schedule: [
      { id: 'evt_live', title: 'Live studio session', startsAt: '2026-10-02T02:00:00.000Z' },
      { id: 'evt_drop', title: 'New set drops', startsAt: '2026-10-05T18:00:00.000Z' },
    ],
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 40).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };

  const jordan: MemoryUser = {
    id: 'usr_jordan',
    authUserId: null,
    username: 'jordanlee',
    displayName: 'Jordan Lee',
    bio: 'Travel diaries and after-hours shoots.',
    location: 'Miami',
    orientation: 'bisexual',
    interests: ['travel', 'nightlife'],
    avatarUrl: avatar('J', '#7c3aed'),
    isCreator: true,
    isVerified: true,
    ageVerification: true,
    followerBase: 640,
    preferencesEnc,
    schedule: [{ id: 'evt_miami', title: 'Miami rooftop set', startsAt: '2026-10-12T23:00:00.000Z' }],
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 20).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };

  const member: MemoryUser = {
    id: 'usr_member',
    authUserId: null,
    username: 'member',
    displayName: 'Member',
    bio: '',
    location: '',
    orientation: null,
    interests: [],
    avatarUrl: avatar('M', '#3f3f46'),
    isCreator: false,
    isVerified: false,
    ageVerification: false,
    followerBase: 0,
    preferencesEnc,
    schedule: [],
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };

  const colors: Array<[string, string]> = [
    ['#881337', '#1c1917'],
    ['#9f1239', '#27272a'],
    ['#be123c', '#111827'],
    ['#e11d48', '#1f2937'],
    ['#fb7185', '#18181b'],
    ['#9d174d', '#0f172a'],
    ['#6d28d9', '#111827'],
    ['#0e7490', '#0f172a'],
  ];

  const content: MemoryContent[] = [];
  for (let index = 0; index < 16; index += 1) {
    const number = index + 1;
    const isVideo = index % 4 === 0;
    const [from, to] = colors[index % colors.length];
    const creatorId = index > 0 && index % 5 === 0 ? jordan.id : alex.id;
    content.push({
      id: `cnt_${String(number).padStart(2, '0')}`,
      creatorId,
      title: isVideo ? `Studio session ${number}` : `Set ${number}`,
      description: 'A published set from the studio archive.',
      tags: index % 2 === 0 ? ['studio', 'set'] : ['studio', 'night'],
      category: isVideo ? 'video' : 'photo',
      mediaUrl: isVideo ? SAMPLE_480 : svgThumb(from, to, String(number)),
      thumbnailUrl: svgThumb(from, to, String(number)),
      mediaType: isVideo ? 'VIDEO' : 'IMAGE',
      qualities: isVideo
        ? [
            { label: '480p', url: SAMPLE_480 },
            { label: '1080p', url: SAMPLE_1080 },
          ]
        : null,
      isPremium: index % 4 === 0,
      status: 'PUBLISHED',
      likeCount: 40 + index * 7,
      viewCount: 220 + index * 31,
      rating: Number((3.4 + (index % 5) * 0.3).toFixed(1)),
      createdAt: new Date(now - (16 - index) * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now).toISOString(),
    });
  }

  return {
    users: new Map([
      [alex.id, alex],
      [jordan.id, jordan],
      [member.id, member],
    ]),
    content,
    likes: [],
    follows: [],
    subscriptions: [],
    audits: [],
    reports: [],
  };
}

function globalStore(): MemoryState {
  const g = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MemoryState };
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = seed();
  return g[GLOBAL_KEY]!;
}

export function resetMemoryStore() {
  const g = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MemoryState };
  g[GLOBAL_KEY] = seed();
}

export function readAuditLog(): AuditEntry[] {
  return [...globalStore().audits];
}

function writeAudit(
  state: MemoryState,
  userId: string | null,
  action: AuditAction,
  entity: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  state.audits.push({
    id: `aud_${state.audits.length + 1}`,
    userId,
    action,
    entity,
    entityId,
    metadata,
    createdAt: new Date().toISOString(),
  });
}

function toSession(user: MemoryUser): SessionUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    ageVerification: user.ageVerification,
    isCreator: user.isCreator,
    authUserId: user.authUserId,
  };
}

function creatorSummary(user: MemoryUser): CreatorSummary {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
    isCreator: user.isCreator,
  };
}

function canViewMedia(state: MemoryState, content: MemoryContent, viewerId: string | null): boolean {
  if (!content.isPremium) return true;
  if (!viewerId) return false;
  if (content.creatorId === viewerId) return true;
  return state.subscriptions.some(
    (row) => row.subscriberId === viewerId && row.creatorId === content.creatorId && row.status === 'ACTIVE',
  );
}

function presentContent(state: MemoryState, content: MemoryContent, viewerId: string | null): ContentItem {
  const creator = state.users.get(content.creatorId);
  if (!creator) throw new ApiError(500, 'Creator missing');
  const locked = !canViewMedia(state, content, viewerId);
  return {
    id: content.id,
    title: content.title,
    description: content.description,
    tags: content.tags,
    category: content.category,
    mediaUrl: locked ? null : content.mediaUrl,
    thumbnailUrl: content.thumbnailUrl,
    mediaType: content.mediaType,
    qualities: locked ? null : content.qualities,
    isPremium: content.isPremium,
    status: content.status,
    likeCount: content.likeCount,
    viewCount: content.viewCount,
    rating: content.rating,
    createdAt: content.createdAt,
    creator: creatorSummary(creator),
    likedByMe: Boolean(viewerId && state.likes.some((row) => row.userId === viewerId && row.contentId === content.id)),
    locked,
  };
}

function published(state: MemoryState): MemoryContent[] {
  return state.content.filter((item) => item.status === 'PUBLISHED');
}

function followerCount(state: MemoryState, user: MemoryUser): number {
  const ids = new Set<string>();
  for (const row of state.follows) {
    if (row.followingId === user.id) ids.add(row.followerId);
  }
  for (const row of state.subscriptions) {
    if (row.creatorId === user.id && row.status === 'ACTIVE') ids.add(row.subscriberId);
  }
  return user.followerBase + ids.size;
}

function contentCount(state: MemoryState, userId: string): number {
  return state.content.filter((item) => item.creatorId === userId && item.status === 'PUBLISHED').length;
}

function requireUser(state: MemoryState, userId: string): MemoryUser {
  const user = state.users.get(userId);
  if (!user) throw new ApiError(404, 'Account not found');
  if (user.ageVerification !== true) throw new ApiError(403, 'Age verification required');
  return user;
}

function parsePreferences(payload: string | null): ProfilePreferences {
  const decoded = decryptJson<Partial<ProfilePreferences>>(payload);
  return {
    ...DEFAULT_PREFERENCES,
    ...decoded,
    notificationEmail: decoded?.notificationEmail ?? '',
  };
}

export function createMemoryStore(): ContentStore {
  return {
    async getUserById(id) {
      const user = globalStore().users.get(id);
      return user ? toSession(user) : null;
    },

    async getUserByAuthId(authUserId) {
      for (const user of globalStore().users.values()) {
        if (user.authUserId === authUserId) return toSession(user);
      }
      return null;
    },

    async confirmAge(userId) {
      const state = globalStore();
      const user = state.users.get(userId);
      if (!user) throw new ApiError(404, 'Account not found');
      user.ageVerification = true;
      user.updatedAt = new Date().toISOString();
      writeAudit(state, user.id, 'update', 'user', user.id, { ageVerification: true });
      return toSession(user);
    },

    async listContent(params, viewerId) {
      const state = globalStore();
      let items = published(state);
      if (params.category) {
        items = items.filter((item) => item.category === params.category);
      }
      if (params.tags?.length) {
        items = items.filter((item) => params.tags!.every((tag) => item.tags.includes(tag)));
      }
      if (params.premiumOnly) {
        items = items.filter((item) => item.isPremium);
      }
      if (params.followingOnly) {
        if (!viewerId) items = [];
        else {
          const following = new Set(
            state.follows.filter((row) => row.followerId === viewerId).map((row) => row.followingId),
          );
          const subscribed = new Set(
            state.subscriptions
              .filter((row) => row.subscriberId === viewerId && row.status === 'ACTIVE')
              .map((row) => row.creatorId),
          );
          items = items.filter((item) => following.has(item.creatorId) || subscribed.has(item.creatorId));
        }
      }
      if (params.creatorUsername) {
        const creator = [...state.users.values()].find((user) => user.username === params.creatorUsername);
        items = creator ? items.filter((item) => item.creatorId === creator.id) : [];
      }
      items = [...items].sort((a, b) => {
        if (params.sort === 'popular') {
          if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
          if (b.viewCount !== a.viewCount) return b.viewCount - a.viewCount;
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
      const pageSize = params.pageSize || PAGE_SIZE;
      const start = (params.page - 1) * pageSize;
      const slice = items.slice(start, start + pageSize);
      return {
        items: slice.map((item) => presentContent(state, item, viewerId)),
        page: params.page,
        pageSize,
        total: items.length,
        hasMore: start + pageSize < items.length,
      };
    },

    async getContent(id, viewerId, options) {
      const state = globalStore();
      const content = state.content.find((item) => item.id === id && item.status !== 'DELETED');
      if (!content) return null;
      if (options?.countView) {
        content.viewCount += 1;
        content.updatedAt = new Date().toISOString();
      }
      return presentContent(state, content, viewerId);
    },

    async relatedContent(id, viewerId) {
      const state = globalStore();
      const current = state.content.find((item) => item.id === id);
      if (!current) return [];
      const related = published(state)
        .filter((item) => item.id !== id)
        .filter((item) => item.creatorId === current.creatorId || item.category === current.category)
        .slice(0, 6);
      return related.map((item) => presentContent(state, item, viewerId));
    },

    async createContent(userId, input) {
      const state = globalStore();
      const user = requireUser(state, userId);
      user.isCreator = true;
      const now = new Date().toISOString();
      const content: MemoryContent = {
        id: `cnt_${crypto.randomUUID().slice(0, 8)}`,
        creatorId: user.id,
        title: input.title,
        description: input.description ?? null,
        tags: input.tags,
        category: input.category ?? null,
        mediaUrl: input.mediaUrl,
        thumbnailUrl: input.thumbnailUrl ?? null,
        mediaType: input.mediaType,
        qualities: input.qualities ?? null,
        isPremium: input.isPremium,
        status: input.status,
        likeCount: 0,
        viewCount: 0,
        rating: input.rating ?? 0,
        createdAt: now,
        updatedAt: now,
      };
      state.content.unshift(content);
      writeAudit(state, user.id, 'create', 'content', content.id, { title: content.title });
      return presentContent(state, content, user.id);
    },

    async updateContent(userId, id, input) {
      const state = globalStore();
      const user = requireUser(state, userId);
      const content = state.content.find((item) => item.id === id && item.status !== 'DELETED');
      if (!content) throw new ApiError(404, 'Content not found');
      if (content.creatorId !== user.id) throw new ApiError(403, 'You can only edit your own content');
      if (input.title !== undefined) content.title = input.title;
      if (input.description !== undefined) content.description = input.description;
      if (input.tags !== undefined) content.tags = input.tags;
      if (input.category !== undefined) content.category = input.category;
      if (input.thumbnailUrl !== undefined) content.thumbnailUrl = input.thumbnailUrl;
      if (input.isPremium !== undefined) content.isPremium = input.isPremium;
      if (input.status !== undefined) content.status = input.status;
      if (input.qualities !== undefined) content.qualities = input.qualities;
      content.updatedAt = new Date().toISOString();
      writeAudit(state, user.id, 'update', 'content', content.id);
      return presentContent(state, content, user.id);
    },

    async softDeleteContent(userId, id) {
      const state = globalStore();
      const user = requireUser(state, userId);
      const content = state.content.find((item) => item.id === id && item.status !== 'DELETED');
      if (!content) throw new ApiError(404, 'Content not found');
      if (content.creatorId !== user.id) throw new ApiError(403, 'You can only delete your own content');
      content.status = 'DELETED';
      content.updatedAt = new Date().toISOString();
      writeAudit(state, user.id, 'delete', 'content', content.id, { status: 'DELETED' });
    },

    async toggleLike(userId, contentId) {
      const state = globalStore();
      requireUser(state, userId);
      const content = state.content.find((item) => item.id === contentId && item.status === 'PUBLISHED');
      if (!content) throw new ApiError(404, 'Content not found');
      const existing = state.likes.findIndex((row) => row.userId === userId && row.contentId === contentId);
      if (existing >= 0) {
        state.likes.splice(existing, 1);
        content.likeCount = Math.max(0, content.likeCount - 1);
        writeAudit(state, userId, 'update', 'like', contentId, { liked: false });
        return { liked: false, likeCount: content.likeCount };
      }
      state.likes.push({ id: `lk_${crypto.randomUUID().slice(0, 8)}`, userId, contentId });
      content.likeCount += 1;
      writeAudit(state, userId, 'update', 'like', contentId, { liked: true });
      return { liked: true, likeCount: content.likeCount };
    },

    async getCreator(username, viewerId) {
      const state = globalStore();
      const user = [...state.users.values()].find((row) => row.username === username);
      if (!user) return null;
      const items = published(state)
        .filter((item) => item.creatorId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((item) => presentContent(state, item, viewerId));
      return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        location: user.location,
        orientation: user.orientation,
        interests: user.interests,
        avatarUrl: user.avatarUrl,
        isCreator: user.isCreator,
        isVerified: user.isVerified,
        ageVerification: user.ageVerification,
        contentCount: contentCount(state, user.id),
        followerCount: followerCount(state, user),
        subscribed: Boolean(
          viewerId &&
            state.subscriptions.some(
              (row) => row.subscriberId === viewerId && row.creatorId === user.id && row.status === 'ACTIVE',
            ),
        ),
        isSelf: viewerId === user.id,
        schedule: user.schedule,
        content: items,
      };
    },

    async getEditableProfile(userId) {
      const state = globalStore();
      const user = state.users.get(userId);
      if (!user) return null;
      return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        location: user.location,
        orientation: user.orientation,
        interests: user.interests,
        avatarUrl: user.avatarUrl,
        isCreator: user.isCreator,
        preferences: parsePreferences(user.preferencesEnc),
      };
    },

    async updateProfile(userId, input: UpdateProfileInput) {
      const state = globalStore();
      const user = requireUser(state, userId);
      user.displayName = input.displayName;
      user.bio = input.bio;
      user.location = input.location;
      user.orientation = input.orientation;
      user.interests = input.interests;
      user.preferencesEnc = encryptJson(input.preferences);
      user.updatedAt = new Date().toISOString();
      writeAudit(state, user.id, 'update', 'profile', user.id, { fields: ['displayName', 'bio', 'preferences'] });
      const editable = await this.getEditableProfile(user.id);
      if (!editable) throw new ApiError(404, 'Profile not found');
      return editable;
    },

    async setAvatar(userId, avatarUrl) {
      const state = globalStore();
      const user = requireUser(state, userId);
      user.avatarUrl = avatarUrl;
      user.updatedAt = new Date().toISOString();
      writeAudit(state, user.id, 'upload', 'profile', user.id, { avatar: true });
      return avatarUrl;
    },

    async toggleSubscribe(userId, username) {
      const state = globalStore();
      const viewer = requireUser(state, userId);
      const creator = [...state.users.values()].find((row) => row.username === username);
      if (!creator) throw new ApiError(404, 'Creator not found');
      if (!creator.isCreator) throw new ApiError(400, 'This member is not a creator');
      if (creator.id === viewer.id) throw new ApiError(400, 'You cannot subscribe to yourself');
      const existing = state.subscriptions.findIndex(
        (row) => row.subscriberId === viewer.id && row.creatorId === creator.id,
      );
      if (existing >= 0) {
        state.subscriptions.splice(existing, 1);
        const follow = state.follows.findIndex(
          (row) => row.followerId === viewer.id && row.followingId === creator.id,
        );
        if (follow >= 0) state.follows.splice(follow, 1);
        writeAudit(state, viewer.id, 'update', 'subscription', creator.id, { subscribed: false });
        return { subscribed: false, followerCount: followerCount(state, creator) };
      }
      state.subscriptions.push({
        id: `sub_${crypto.randomUUID().slice(0, 8)}`,
        subscriberId: viewer.id,
        creatorId: creator.id,
        status: 'ACTIVE',
      });
      if (!state.follows.some((row) => row.followerId === viewer.id && row.followingId === creator.id)) {
        state.follows.push({
          id: `flw_${crypto.randomUUID().slice(0, 8)}`,
          followerId: viewer.id,
          followingId: creator.id,
        });
      }
      writeAudit(state, viewer.id, 'create', 'subscription', creator.id, { subscribed: true });
      return { subscribed: true, followerCount: followerCount(state, creator) };
    },

    async reportContent(userId, contentId, reason, details) {
      const state = globalStore();
      requireUser(state, userId);
      const content = state.content.find((item) => item.id === contentId && item.status !== 'DELETED');
      if (!content) throw new ApiError(404, 'Content not found');
      const already = state.reports.some((row) => row.reporterId === userId && row.contentId === contentId);
      if (already) return { alreadyReported: true };
      state.reports.push({
        id: `rpt_${crypto.randomUUID().slice(0, 8)}`,
        reporterId: userId,
        contentId,
        reason,
        details,
      });
      writeAudit(state, userId, 'create', 'report', contentId, { reason });
      return { alreadyReported: false };
    },
  };
}

export function ensureLocalDemoUser(): SessionUser {
  const state = globalStore();
  const member = state.users.get('usr_member');
  if (!member) throw new ApiError(500, 'Demo member is missing');
  return toSession(member);
}
