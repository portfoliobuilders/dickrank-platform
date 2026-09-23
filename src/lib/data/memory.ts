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
import type { ContentStore, ListContentParams } from '@/lib/data/types';

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

interface MemoryLike {
  id: string;
  userId: string;
  contentId: string;
}

interface MemoryFollow {
  id: string;
  followerId: string;
  followingId: string;
}

interface MemorySubscription {
  id: string;
  subscriberId: string;
  creatorId: string;
  status: 'ACTIVE';
}

interface MemoryAudit {
  id: string;
  userId: string | null;
  action: 'create' | 'update' | 'delete' | 'upload';
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface MemoryReport {
  id: string;
  reporterId: string;
  contentId: string;
  reason: string;
  details?: string;
}

interface MemoryState {
  users: Map<string, MemoryUser>;
  content: MemoryContent[];
  likes: MemoryLike[];
  follows: MemoryFollow[];
  subscriptions: MemorySubscription[];
  audits: MemoryAudit[];
  reports: MemoryReport[];
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

function seed(): MemoryState {
  const now = new Date('2026-09-20T12:00:00.000Z').getTime();
  const preferencesEnc = encryptJson(DEFAULT_PREFERENCES);
  const alex: MemoryUser = {
    id: 'usr_alex',
    authUserId: null,
    username: 'alexrivera',
    displayName: 'Alex Rivera',
    bio: 'Photographer and performer. New sets every week.',
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
  ];

  const content: MemoryContent[] = Array.from({ length: 14 }, (_, index) => {
    const number = index + 1;
    const isVideo = index % 4 === 0;
    const [from, to] = colors[index % colors.length];
    const createdAt = new Date(now - (14 - index) * 60 * 60 * 1000).toISOString();
    return {
      id: `cnt_${String(number).padStart(2, '0')}`,
      creatorId: alex.id,
      title: isVideo ? `Studio session ${number}` : `Set ${number}`,
      description: 'A published set from the studio archive.',
      tags: index % 2 === 0 ? ['studio', 'set'] : ['studio', 'night'],
      category: isVideo ? 'video' : 'photo',
      mediaUrl: isVideo
        ? 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
        : svgThumb(from, to, String(number)),
      thumbnailUrl: svgThumb(from, to, String(number)),
      mediaType: isVideo ? 'VIDEO' : 'IMAGE',
      qualities: isVideo
        ? [
            {
              label: '480p',
              url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
            },
            {
              label: '1080p',
              url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
            },
          ]
        : null,
      isPremium: index % 5 === 0,
      status: 'PUBLISHED',
      likeCount: [42, 11, 88, 7, 19, 64, 3, 27, 51, 9, 73, 15, 6, 33][index] ?? 0,
      viewCount: 100 + index * 17,
      rating: [4.8, 4.2, 4.9, 3.8, 4.4, 4.7, 3.6, 4.1, 4.6, 4.0, 4.9, 3.9, 4.3, 4.5][index] ?? 0,
      createdAt,
      updatedAt: createdAt,
    };
  });

  return {
    users: new Map([
      [alex.id, alex],
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

function globalBag(): Record<string, MemoryState | undefined> {
  return globalThis as unknown as Record<string, MemoryState | undefined>;
}

function state(): MemoryState {
  const bag = globalBag();
  if (!bag[GLOBAL_KEY]) bag[GLOBAL_KEY] = seed();
  return bag[GLOBAL_KEY] as MemoryState;
}

export function resetMemoryStore(): void {
  globalBag()[GLOBAL_KEY] = seed();
}

export function readAuditLog() {
  return state().audits;
}

function audit(
  entry: Omit<MemoryAudit, 'id' | 'createdAt'>,
): void {
  state().audits.push({
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
}

function mustUser(id: string): MemoryUser {
  const user = state().users.get(id);
  if (!user) throw new ApiError(404, 'Profile not found');
  return user;
}

function toSession(user: MemoryUser): SessionUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    ageVerification: user.ageVerification === true,
    isCreator: user.isCreator,
    authUserId: user.authUserId,
  };
}

function toSummary(user: MemoryUser): CreatorSummary {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
    isCreator: user.isCreator,
  };
}

function followerCount(user: MemoryUser): number {
  const extra = state().follows.filter((follow) => follow.followingId === user.id).length;
  return user.followerBase + extra;
}

function contentCount(userId: string): number {
  return state().content.filter((item) => item.creatorId === userId && item.status === 'PUBLISHED').length;
}

function isSubscribed(viewerId: string | null, creatorId: string): boolean {
  if (!viewerId) return false;
  return state().subscriptions.some(
    (subscription) =>
      subscription.subscriberId === viewerId &&
      subscription.creatorId === creatorId &&
      subscription.status === 'ACTIVE',
  );
}

function isLocked(content: MemoryContent, viewerId: string | null): boolean {
  if (!content.isPremium) return false;
  if (viewerId && viewerId === content.creatorId) return false;
  return !isSubscribed(viewerId, content.creatorId);
}

function present(content: MemoryContent, viewerId: string | null, detail: boolean): ContentItem {
  const creator = mustUser(content.creatorId);
  const locked = isLocked(content, viewerId);
  const hideMedia = !detail || locked;
  return {
    id: content.id,
    title: content.title,
    description: content.description,
    tags: content.tags,
    category: content.category,
    mediaUrl: hideMedia ? null : content.mediaUrl,
    thumbnailUrl: content.thumbnailUrl,
    mediaType: content.mediaType,
    qualities: hideMedia ? null : content.qualities,
    isPremium: content.isPremium,
    status: content.status,
    likeCount: content.likeCount,
    viewCount: content.viewCount,
    rating: content.rating,
    createdAt: content.createdAt,
    creator: toSummary(creator),
    likedByMe: viewerId
      ? state().likes.some((like) => like.userId === viewerId && like.contentId === content.id)
      : false,
    locked,
  };
}

function findByUsername(username: string): MemoryUser | undefined {
  const key = username.toLowerCase();
  return [...state().users.values()].find((user) => user.username.toLowerCase() === key);
}

function preferencesOf(user: MemoryUser): ProfilePreferences {
  return decryptJson<ProfilePreferences>(user.preferencesEnc) ?? DEFAULT_PREFERENCES;
}

function toEditable(user: MemoryUser) {
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
    preferences: preferencesOf(user),
  };
}

export function ensureDemoUser(): SessionUser {
  return toSession(mustUser('usr_member'));
}

export function createMemoryStore(): ContentStore {
  return {
    async getUserById(id) {
      const user = state().users.get(id);
      return user ? toSession(user) : null;
    },
    async getUserByAuthId(authUserId) {
      const user = [...state().users.values()].find((entry) => entry.authUserId === authUserId);
      return user ? toSession(user) : null;
    },
    async confirmAge(userId) {
      const user = mustUser(userId);
      if (user.ageVerification !== true) {
        user.ageVerification = true;
        user.updatedAt = new Date().toISOString();
        audit({ userId, action: 'update', entity: 'user', entityId: userId, metadata: { ageVerification: true } });
      }
      return toSession(user);
    },
    async listContent(params: ListContentParams, viewerId) {
      const pageSize = Math.min(Math.max(params.pageSize || PAGE_SIZE, 1), 24);
      const page = Math.max(params.page, 1);
      let items = state().content.filter((item) => item.status === 'PUBLISHED');
      if (params.category) {
        items = items.filter((item) => item.category === params.category);
      }
      if (params.tags && params.tags.length > 0) {
        items = items.filter((item) => params.tags!.every((tag) => item.tags.includes(tag)));
      }
      if (params.premiumOnly) items = items.filter((item) => item.isPremium);
      if (params.creatorUsername) {
        const creator = findByUsername(params.creatorUsername);
        items = creator ? items.filter((item) => item.creatorId === creator.id) : [];
      }
      if (params.followingOnly) {
        if (!viewerId) items = [];
        else {
          const following = new Set(
            state()
              .follows.filter((follow) => follow.followerId === viewerId)
              .map((follow) => follow.followingId),
          );
          items = items.filter((item) => following.has(item.creatorId));
        }
      }
      items.sort((a, b) => {
        if (params.sort === 'popular' && b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
        return b.createdAt.localeCompare(a.createdAt);
      });
      const total = items.length;
      const start = (page - 1) * pageSize;
      const slice = items.slice(start, start + pageSize).map((item) => present(item, viewerId, false));
      return { items: slice, page, pageSize, total, hasMore: start + pageSize < total };
    },
    async getContent(id, viewerId, options) {
      const content = state().content.find((item) => item.id === id && item.status !== 'DELETED');
      if (!content || content.status !== 'PUBLISHED') return null;
      if (options?.countView !== false) content.viewCount += 1;
      return present(content, viewerId, true);
    },
    async relatedContent(id, viewerId) {
      const current = state().content.find((item) => item.id === id);
      if (!current) return [];
      const scored = state()
        .content.filter((item) => item.id !== id && item.status === 'PUBLISHED')
        .map((item) => {
          const shared = item.tags.filter((tag) => current.tags.includes(tag)).length;
          const sameCategory = item.category && item.category === current.category ? 2 : 0;
          return { item, score: shared + sameCategory };
        })
        .sort((a, b) => b.score - a.score || b.item.createdAt.localeCompare(a.item.createdAt))
        .slice(0, 8);
      return scored.map(({ item }) => present(item, viewerId, false));
    },
    async createContent(userId, input: CreateContentInput) {
      const user = mustUser(userId);
      if (user.ageVerification !== true) throw new ApiError(403, 'Age verification required');
      const timestamp = new Date().toISOString();
      const content: MemoryContent = {
        id: `cnt_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
        creatorId: userId,
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
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      state().content.push(content);
      if (!user.isCreator) user.isCreator = true;
      audit({ userId, action: 'create', entity: 'content', entityId: content.id });
      return present(content, userId, true);
    },
    async updateContent(userId, id, input: UpdateContentInput) {
      const content = state().content.find((item) => item.id === id && item.status !== 'DELETED');
      if (!content) throw new ApiError(404, 'Content not found');
      if (content.creatorId !== userId) throw new ApiError(403, 'You can only edit your own content');
      if (input.title !== undefined) content.title = input.title;
      if (input.description !== undefined) content.description = input.description;
      if (input.tags !== undefined) content.tags = input.tags;
      if (input.category !== undefined) content.category = input.category;
      if (input.thumbnailUrl !== undefined) content.thumbnailUrl = input.thumbnailUrl;
      if (input.isPremium !== undefined) content.isPremium = input.isPremium;
      if (input.status !== undefined) content.status = input.status;
      if (input.qualities !== undefined) content.qualities = input.qualities;
      content.updatedAt = new Date().toISOString();
      audit({ userId, action: 'update', entity: 'content', entityId: id });
      return present(content, userId, true);
    },
    async softDeleteContent(userId, id) {
      const content = state().content.find((item) => item.id === id && item.status !== 'DELETED');
      if (!content) throw new ApiError(404, 'Content not found');
      if (content.creatorId !== userId) throw new ApiError(403, 'You can only delete your own content');
      content.status = 'DELETED';
      content.updatedAt = new Date().toISOString();
      audit({ userId, action: 'delete', entity: 'content', entityId: id, metadata: { status: 'DELETED' } });
    },
    async toggleLike(userId, contentId) {
      mustUser(userId);
      const content = state().content.find((item) => item.id === contentId && item.status === 'PUBLISHED');
      if (!content) throw new ApiError(404, 'Content not found');
      const index = state().likes.findIndex((like) => like.userId === userId && like.contentId === contentId);
      let liked: boolean;
      if (index >= 0) {
        state().likes.splice(index, 1);
        content.likeCount = Math.max(0, content.likeCount - 1);
        liked = false;
      } else {
        state().likes.push({ id: crypto.randomUUID(), userId, contentId });
        content.likeCount += 1;
        liked = true;
      }
      audit({
        userId,
        action: 'update',
        entity: 'content',
        entityId: contentId,
        metadata: { liked },
      });
      return { liked, likeCount: content.likeCount };
    },
    async getCreator(username, viewerId) {
      const user = findByUsername(username);
      if (!user) return null;
      const content = state()
        .content.filter((item) => item.creatorId === user.id && item.status === 'PUBLISHED')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 24)
        .map((item) => present(item, viewerId, false));
      const profile: PublicProfile = {
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
        ageVerification: user.ageVerification === true,
        contentCount: contentCount(user.id),
        followerCount: followerCount(user),
        subscribed: isSubscribed(viewerId, user.id),
        isSelf: viewerId === user.id,
        schedule: user.schedule,
        content,
      };
      return profile;
    },
    async getEditableProfile(userId) {
      return toEditable(mustUser(userId));
    },
    async updateProfile(userId, input: UpdateProfileInput) {
      const user = mustUser(userId);
      user.displayName = input.displayName;
      user.bio = input.bio || null;
      user.location = input.location || null;
      user.orientation = input.orientation;
      user.interests = input.interests;
      user.preferencesEnc = encryptJson(input.preferences);
      user.updatedAt = new Date().toISOString();
      audit({
        userId,
        action: 'update',
        entity: 'user',
        entityId: userId,
        metadata: { fields: ['displayName', 'bio', 'location', 'orientation', 'interests', 'preferences'] },
      });
      return toEditable(user);
    },
    async setAvatar(userId, avatarUrl) {
      const user = mustUser(userId);
      user.avatarUrl = avatarUrl;
      user.updatedAt = new Date().toISOString();
      audit({ userId, action: 'upload', entity: 'user', entityId: userId, metadata: { field: 'avatar' } });
      return avatarUrl;
    },
    async toggleSubscribe(userId, username) {
      const viewer = mustUser(userId);
      const creator = findByUsername(username);
      if (!creator) throw new ApiError(404, 'Creator not found');
      if (!creator.isCreator) throw new ApiError(400, 'This member is not a creator');
      if (creator.id === viewer.id) throw new ApiError(400, 'You cannot subscribe to yourself');
      const existing = state().subscriptions.find(
        (subscription) => subscription.subscriberId === viewer.id && subscription.creatorId === creator.id,
      );
      if (existing) {
        state().subscriptions = state().subscriptions.filter((subscription) => subscription !== existing);
        state().follows = state().follows.filter(
          (follow) => !(follow.followerId === viewer.id && follow.followingId === creator.id),
        );
        audit({ userId, action: 'delete', entity: 'subscription', entityId: creator.id });
        return { subscribed: false, followerCount: followerCount(creator) };
      }
      state().subscriptions.push({
        id: crypto.randomUUID(),
        subscriberId: viewer.id,
        creatorId: creator.id,
        status: 'ACTIVE',
      });
      state().follows.push({
        id: crypto.randomUUID(),
        followerId: viewer.id,
        followingId: creator.id,
      });
      audit({ userId, action: 'create', entity: 'subscription', entityId: creator.id });
      return { subscribed: true, followerCount: followerCount(creator) };
    },
    async reportContent(userId, contentId, reason, details) {
      const content = state().content.find((item) => item.id === contentId && item.status === 'PUBLISHED');
      if (!content) throw new ApiError(404, 'Content not found');
      const existing = state().reports.find((report) => report.reporterId === userId && report.contentId === contentId);
      if (existing) return { alreadyReported: true };
      state().reports.push({
        id: crypto.randomUUID(),
        reporterId: userId,
        contentId,
        reason,
        details,
      });
      audit({ userId, action: 'create', entity: 'report', entityId: contentId, metadata: { reason } });
      return { alreadyReported: false };
    },
  };
}
