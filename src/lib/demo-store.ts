import { PAGE_SIZE } from "@/lib/constants";
import type {
  ContentDetail,
  ContentListResponse,
  CreateContentInput,
  ListContentQuery,
  OwnProfile,
  PublicProfile,
  ScheduleItem,
  UpdateContentInput,
  UpdateProfileInput,
  Viewer,
} from "@/types";

type DemoContent = ContentDetail & { creatorId: string };

const viewerId = "00000000-0000-4000-8000-000000000001";
const rowanId = "00000000-0000-4000-8000-000000000010";
const quinnId = "00000000-0000-4000-8000-000000000011";

function svgThumb(label: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="52%" fill="white" font-size="42" text-anchor="middle" font-family="sans-serif">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const VIDEO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

function makeContent(input: Omit<DemoContent, "locked" | "liked">): DemoContent {
  return { ...input, locked: false, liked: false };
}

function seedContent(): DemoContent[] {
  return [
    makeContent({
      id: "11111111-1111-4111-8111-111111111111",
      creatorId: rowanId,
      title: "Studio session",
      description: "A short studio clip from Rowan.",
      tags: ["studio", "video"],
      category: "studio",
      mediaUrl: VIDEO_URL,
      mediaType: "video",
      thumbnailUrl: svgThumb("Studio", "#9f1239"),
      blurDataUrl: svgThumb("Studio", "#4c0519"),
      qualities: [
        { label: "720p", src: VIDEO_URL },
        { label: "480p", src: VIDEO_URL },
      ],
      isPremium: false,
      likeCount: 18,
      viewCount: 240,
      rating: 4.6,
      status: "PUBLISHED",
      createdAt: "2026-09-20T15:00:00.000Z",
      creator: {
        id: rowanId,
        username: "rowan",
        displayName: "Rowan",
        avatarUrl: null,
        isVerified: true,
        isCreator: true,
      },
    }),
    makeContent({
      id: "22222222-2222-4222-8222-222222222222",
      creatorId: rowanId,
      title: "Portrait set",
      description: "Still portraits from the same week.",
      tags: ["photo", "portrait"],
      category: "photos",
      mediaUrl: svgThumb("Portrait", "#1d4ed8"),
      mediaType: "image",
      thumbnailUrl: svgThumb("Portrait", "#1d4ed8"),
      blurDataUrl: svgThumb("Portrait", "#172554"),
      qualities: null,
      isPremium: true,
      likeCount: 42,
      viewCount: 510,
      rating: 4.9,
      status: "PUBLISHED",
      createdAt: "2026-09-18T15:00:00.000Z",
      creator: {
        id: rowanId,
        username: "rowan",
        displayName: "Rowan",
        avatarUrl: null,
        isVerified: true,
        isCreator: true,
      },
    }),
    makeContent({
      id: "33333333-3333-4333-8333-333333333333",
      creatorId: quinnId,
      title: "Night set",
      description: "Quinn's latest photo.",
      tags: ["photo", "night"],
      category: "photos",
      mediaUrl: svgThumb("Night", "#6d28d9"),
      mediaType: "image",
      thumbnailUrl: svgThumb("Night", "#6d28d9"),
      blurDataUrl: svgThumb("Night", "#2e1065"),
      qualities: null,
      isPremium: true,
      likeCount: 63,
      viewCount: 880,
      rating: 4.4,
      status: "PUBLISHED",
      createdAt: "2026-09-22T15:00:00.000Z",
      creator: {
        id: quinnId,
        username: "quinn",
        displayName: "Quinn",
        avatarUrl: null,
        isVerified: false,
        isCreator: true,
      },
    }),
    makeContent({
      id: "44444444-4444-4444-8444-444444444444",
      creatorId: quinnId,
      title: "Warmup clip",
      description: "A free preview clip.",
      tags: ["video", "preview"],
      category: "studio",
      mediaUrl: VIDEO_URL,
      mediaType: "video",
      thumbnailUrl: svgThumb("Preview", "#0f766e"),
      blurDataUrl: svgThumb("Preview", "#042f2e"),
      qualities: [{ label: "Auto", src: VIDEO_URL }],
      isPremium: false,
      likeCount: 9,
      viewCount: 120,
      rating: 4.1,
      status: "PUBLISHED",
      createdAt: "2026-09-12T15:00:00.000Z",
      creator: {
        id: quinnId,
        username: "quinn",
        displayName: "Quinn",
        avatarUrl: null,
        isVerified: false,
        isCreator: true,
      },
    }),
  ];
}

type DemoProfile = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string;
  location: string;
  orientation: OwnProfile["orientation"];
  interests: string[];
  avatarUrl: string | null;
  isCreator: boolean;
  isVerified: boolean;
  ageVerified: boolean;
  isPrivate: boolean;
  acceptsSubscriptions: boolean;
  contentCount: number;
  followerCount: number;
  preferences: OwnProfile["preferences"];
};

type State = {
  viewer: DemoProfile;
  profiles: DemoProfile[];
  content: DemoContent[];
  likes: Set<string>;
  follows: Set<string>;
  subscriptions: Set<string>;
  reports: Array<{ contentId: string; reason: string; details?: string }>;
  audits: Array<Record<string, unknown>>;
};

function seedState(): State {
  const viewer: DemoProfile = {
    id: viewerId,
    username: "you",
    displayName: "You",
    bio: "Preview account",
    location: "",
    orientation: "undisclosed",
    interests: [],
    avatarUrl: null,
    isCreator: true,
    isVerified: false,
    ageVerified: true,
    isPrivate: false,
    acceptsSubscriptions: true,
    contentCount: 0,
    followerCount: 0,
    preferences: {
      privateAccount: false,
      showActivity: true,
      allowSubscriptions: true,
      emailDigest: false,
      notificationEmail: "",
      contentWarnings: true,
    },
  };
  const rowan: DemoProfile = {
    id: rowanId,
    username: "rowan",
    displayName: "Rowan",
    bio: "Photographer and performer. New sets every Friday.",
    location: "Los Angeles",
    orientation: "bisexual",
    interests: ["photography", "studio", "live shows"],
    avatarUrl: null,
    isCreator: true,
    isVerified: true,
    ageVerified: true,
    isPrivate: false,
    acceptsSubscriptions: true,
    contentCount: 2,
    followerCount: 1280,
    preferences: {
      privateAccount: false,
      showActivity: true,
      allowSubscriptions: true,
      emailDigest: false,
      notificationEmail: "",
      contentWarnings: true,
    },
  };
  const quinn: DemoProfile = {
    id: quinnId,
    username: "quinn",
    displayName: "Quinn",
    bio: "Independent creator. Premium sets drop twice a month.",
    location: "Berlin",
    orientation: "queer",
    interests: ["film", "travel"],
    avatarUrl: null,
    isCreator: true,
    isVerified: false,
    ageVerified: true,
    isPrivate: false,
    acceptsSubscriptions: true,
    contentCount: 2,
    followerCount: 640,
    preferences: {
      privateAccount: false,
      showActivity: true,
      allowSubscriptions: true,
      emailDigest: false,
      notificationEmail: "",
      contentWarnings: true,
    },
  };
  return {
    viewer,
    profiles: [viewer, rowan, quinn],
    content: seedContent(),
    likes: new Set([`22222222-2222-4222-8222-222222222222`]),
    follows: new Set([rowanId]),
    subscriptions: new Set([rowanId]),
    reports: [],
    audits: [],
  };
}

let state = seedState();

export function resetDemoStore() {
  state = seedState();
}

function syncCounts(profileId: string) {
  const profile = state.profiles.find((item) => item.id === profileId);
  if (!profile) return;
  profile.contentCount = state.content.filter(
    (item) => item.creatorId === profileId && item.status === "PUBLISHED",
  ).length;
  profile.followerCount = [...state.follows].filter((id) => id === profileId).length + (profileId === rowanId ? 1279 : profileId === quinnId ? 640 : 0);
}

function toViewer(profile: DemoProfile): Viewer {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    isCreator: profile.isCreator,
    ageVerified: profile.ageVerified,
  };
}

export function demoViewer(): Viewer {
  return toViewer(state.viewer);
}

function hasAccess(content: DemoContent, viewer: string) {
  if (!content.isPremium || content.creatorId === viewer) return true;
  return state.subscriptions.has(content.creatorId);
}

function toCard(content: DemoContent) {
  return {
    id: content.id,
    title: content.title,
    thumbnailUrl: content.thumbnailUrl,
    blurDataUrl: content.blurDataUrl,
    isPremium: content.isPremium,
    viewCount: content.viewCount,
    likeCount: content.likeCount,
    rating: content.rating,
    mediaType: content.mediaType,
    creatorName: content.creator.displayName ?? content.creator.username,
    creatorUsername: content.creator.username,
  };
}

function toDetail(content: DemoContent, viewer: string): ContentDetail {
  const locked = !hasAccess(content, viewer);
  return {
    ...content,
    mediaUrl: locked ? null : content.mediaUrl,
    qualities: locked ? null : content.qualities,
    locked,
    liked: state.likes.has(content.id),
  };
}

export function demoListContent(query: ListContentQuery): ContentListResponse {
  let items = state.content.filter((item) => item.status === "PUBLISHED");
  if (query.category) items = items.filter((item) => item.category === query.category);
  if (query.tags?.length) {
    items = items.filter((item) => query.tags?.some((tag) => item.tags.includes(tag)));
  }
  if (query.creator) {
    items = items.filter((item) => item.creator.username.toLowerCase() === query.creator?.toLowerCase());
  }
  if (query.feed === "premium") items = items.filter((item) => item.isPremium);
  if (query.feed === "following") items = items.filter((item) => state.follows.has(item.creatorId));
  items = [...items].sort((a, b) => {
    if (query.sort === "popular" || query.feed === "popular") return b.likeCount - a.likeCount;
    return b.createdAt.localeCompare(a.createdAt);
  });
  const total = items.length;
  const start = (query.page - 1) * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);
  return {
    items: pageItems.map(toCard),
    page: query.page,
    pageSize: PAGE_SIZE,
    total,
    hasMore: start + pageItems.length < total,
  };
}

export function demoGetContent(id: string, viewer: string): ContentDetail | null {
  const content = state.content.find((item) => item.id === id);
  if (!content || (content.status === "DELETED" && content.creatorId !== viewer)) return null;
  if (content.creatorId !== viewer && content.status === "PUBLISHED") content.viewCount += 1;
  return toDetail(content, viewer);
}

export function demoRelated(id: string): ContentListResponse["items"] {
  const current = state.content.find((item) => item.id === id);
  if (!current) return [];
  return state.content
    .filter((item) => item.id !== id && item.status === "PUBLISHED")
    .filter((item) => item.creatorId === current.creatorId || item.tags.some((tag) => current.tags.includes(tag)))
    .slice(0, 8)
    .map(toCard);
}

export function demoCreateContent(viewer: Viewer, input: CreateContentInput): ContentDetail {
  const profile = state.profiles.find((item) => item.id === viewer.id);
  if (!profile) throw new Error("Profile not found");
  const content = makeContent({
    id: crypto.randomUUID(),
    creatorId: viewer.id,
    title: input.title,
    description: input.description,
    tags: input.tags,
    category: input.category,
    mediaUrl: input.mediaUrl,
    mediaType: input.mediaType,
    thumbnailUrl: input.thumbnailUrl ?? null,
    blurDataUrl: input.blurDataUrl ?? null,
    qualities: input.qualities ?? null,
    isPremium: input.isPremium,
    likeCount: 0,
    viewCount: 0,
    rating: null,
    status: "PUBLISHED",
    createdAt: new Date().toISOString(),
    creator: {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      isVerified: profile.isVerified,
      isCreator: profile.isCreator,
    },
  });
  state.content.unshift(content);
  syncCounts(viewer.id);
  return toDetail(content, viewer.id);
}

export function demoUpdateContent(viewer: Viewer, id: string, input: UpdateContentInput): ContentDetail {
  const content = state.content.find((item) => item.id === id);
  if (!content) throw Object.assign(new Error("Content not found"), { status: 404 });
  if (content.creatorId !== viewer.id) throw Object.assign(new Error("Only the creator can edit this"), { status: 403 });
  if (content.status === "DELETED") throw Object.assign(new Error("Deleted content cannot be edited"), { status: 409 });
  if (input.title !== undefined) content.title = input.title;
  if (input.description !== undefined) content.description = input.description;
  if (input.tags !== undefined) content.tags = input.tags;
  if (input.category !== undefined) content.category = input.category;
  if (input.mediaUrl !== undefined) content.mediaUrl = input.mediaUrl;
  if (input.mediaType !== undefined) content.mediaType = input.mediaType;
  if (input.thumbnailUrl !== undefined) content.thumbnailUrl = input.thumbnailUrl;
  if (input.blurDataUrl !== undefined) content.blurDataUrl = input.blurDataUrl;
  if (input.isPremium !== undefined) content.isPremium = input.isPremium;
  if (input.qualities !== undefined) content.qualities = input.qualities;
  return toDetail(content, viewer.id);
}

export function demoSoftDelete(viewer: Viewer, id: string) {
  const content = state.content.find((item) => item.id === id);
  if (!content) throw Object.assign(new Error("Content not found"), { status: 404 });
  if (content.creatorId !== viewer.id) throw Object.assign(new Error("Only the creator can delete this"), { status: 403 });
  content.status = "DELETED";
  content.mediaUrl = null;
  syncCounts(viewer.id);
  return { id: content.id, status: "DELETED" as const };
}

export function demoToggleLike(viewer: string, contentId: string) {
  const content = state.content.find((item) => item.id === contentId && item.status !== "DELETED");
  if (!content) throw Object.assign(new Error("Content not found"), { status: 404 });
  if (state.likes.has(contentId)) {
    state.likes.delete(contentId);
    content.likeCount = Math.max(0, content.likeCount - 1);
    return { liked: false, likeCount: content.likeCount };
  }
  state.likes.add(contentId);
  content.likeCount += 1;
  return { liked: true, likeCount: content.likeCount };
}

function toPublic(profile: DemoProfile, viewer: string): PublicProfile {
  const isOwner = profile.id === viewer;
  const hide = profile.isPrivate && !isOwner;
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    location: hide ? null : profile.location,
    orientation: hide ? null : profile.orientation,
    interests: hide ? [] : profile.interests,
    avatarUrl: profile.avatarUrl,
    isCreator: profile.isCreator,
    isVerified: profile.isVerified,
    isPrivate: profile.isPrivate,
    contentCount: profile.contentCount,
    followerCount: profile.followerCount,
    acceptsSubscriptions: profile.acceptsSubscriptions,
    viewerSubscribed: state.subscriptions.has(profile.id),
    isOwner,
  };
}

export function demoGetPublicProfile(username: string, viewer: string): PublicProfile | null {
  const profile = state.profiles.find((item) => item.username.toLowerCase() === username.toLowerCase());
  return profile ? toPublic(profile, viewer) : null;
}

export function demoListSchedule(username: string): ScheduleItem[] {
  if (username.toLowerCase() === "rowan") {
    return [
      {
        id: "55555555-5555-4555-8555-555555555555",
        title: "Friday studio live",
        description: "Members-only live set.",
        startsAt: "2026-10-02T20:00:00.000Z",
      },
      {
        id: "66666666-6666-4666-8666-666666666666",
        title: "Photo drop",
        description: "New portrait set.",
        startsAt: "2026-10-16T18:00:00.000Z",
      },
    ];
  }
  return [];
}

export function demoGetOwnProfile(): OwnProfile {
  const profile = state.viewer;
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    location: profile.location,
    orientation: profile.orientation,
    interests: profile.interests,
    avatarUrl: profile.avatarUrl,
    isCreator: profile.isCreator,
    isVerified: profile.isVerified,
    preferences: profile.preferences,
  };
}

export function demoUpdateOwnProfile(input: UpdateProfileInput): OwnProfile {
  const profile = state.viewer;
  profile.displayName = input.displayName;
  profile.bio = input.bio;
  profile.location = input.location;
  profile.orientation = input.orientation;
  profile.interests = [...new Set(input.interests)];
  profile.preferences = input.preferences;
  profile.isPrivate = input.preferences.privateAccount;
  profile.acceptsSubscriptions = input.preferences.allowSubscriptions;
  if (input.avatarUrl) profile.avatarUrl = input.avatarUrl;
  return demoGetOwnProfile();
}

export function demoToggleSubscription(viewer: string, username: string) {
  const profile = state.profiles.find((item) => item.username.toLowerCase() === username.toLowerCase());
  if (!profile) throw Object.assign(new Error("Creator not found"), { status: 404 });
  if (!profile.isCreator) throw Object.assign(new Error("This member is not a creator"), { status: 400 });
  if (profile.id === viewer) throw Object.assign(new Error("You cannot subscribe to yourself"), { status: 400 });
  if (!profile.acceptsSubscriptions) {
    throw Object.assign(new Error("This creator is not taking subscriptions"), { status: 403 });
  }
  const subscribed = state.subscriptions.has(profile.id);
  if (subscribed) {
    state.subscriptions.delete(profile.id);
    state.follows.delete(profile.id);
  } else {
    state.subscriptions.add(profile.id);
    state.follows.add(profile.id);
  }
  syncCounts(profile.id);
  return { subscribed: !subscribed, followerCount: profile.followerCount };
}

export function demoReport(contentId: string, reason: string, details?: string) {
  const content = state.content.find((item) => item.id === contentId && item.status !== "DELETED");
  if (!content) throw Object.assign(new Error("Content not found"), { status: 404 });
  if (state.reports.some((item) => item.contentId === contentId && item.reason === reason)) {
    return { ok: true, duplicate: true };
  }
  state.reports.push({ contentId, reason, details });
  return { ok: true, duplicate: false };
}

export function demoConfirmAge() {
  state.viewer.ageVerified = true;
  return { ageVerified: true };
}

export function demoRecordAudit(entry: Record<string, unknown>) {
  state.audits.push(entry);
}

export function demoAudits() {
  return state.audits;
}
