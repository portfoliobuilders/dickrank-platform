export type MediaType = "image" | "video";

export type ContentStatus = "DRAFT" | "PUBLISHED" | "DELETED";

export type FeedFilter = "following" | "popular" | "new" | "premium";

export type ContentSort = "newest" | "popular";

export type Orientation =
  | "straight"
  | "gay"
  | "lesbian"
  | "bisexual"
  | "pansexual"
  | "queer"
  | "asexual"
  | "other"
  | "undisclosed";

export type MediaQuality = {
  label: string;
  src: string;
};

export type Preferences = {
  privateAccount: boolean;
  showActivity: boolean;
  allowSubscriptions: boolean;
  emailDigest: boolean;
  notificationEmail: string;
  contentWarnings: boolean;
};

export type Viewer = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isCreator: boolean;
  ageVerified: boolean;
};

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  orientation: Orientation | null;
  interests: string[];
  avatarUrl: string | null;
  isCreator: boolean;
  isVerified: boolean;
  isPrivate: boolean;
  contentCount: number;
  followerCount: number;
  acceptsSubscriptions: boolean;
  viewerSubscribed: boolean;
  isOwner: boolean;
};

export type OwnProfile = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string;
  location: string;
  orientation: Orientation;
  interests: string[];
  avatarUrl: string | null;
  isCreator: boolean;
  isVerified: boolean;
  preferences: Preferences;
};

export type ContentCardModel = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  blurDataUrl: string | null;
  isPremium: boolean;
  viewCount: number;
  likeCount: number;
  rating: number | null;
  mediaType: MediaType;
  creatorName: string;
  creatorUsername: string;
};

export type ContentDetail = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  category: string | null;
  mediaUrl: string | null;
  mediaType: MediaType;
  thumbnailUrl: string | null;
  blurDataUrl: string | null;
  qualities: MediaQuality[] | null;
  isPremium: boolean;
  likeCount: number;
  viewCount: number;
  rating: number | null;
  status: ContentStatus;
  createdAt: string;
  locked: boolean;
  liked: boolean;
  creator: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    isVerified: boolean;
    isCreator: boolean;
  };
};

export type ContentListResponse = {
  items: ContentCardModel[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type ScheduleItem = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
};

export type ListContentQuery = {
  category?: string;
  tags?: string[];
  sort: ContentSort;
  page: number;
  feed?: FeedFilter;
  creator?: string;
};

export type CreateContentInput = {
  title: string;
  description: string;
  tags: string[];
  category: string;
  mediaUrl: string;
  mediaType: MediaType;
  thumbnailUrl?: string;
  blurDataUrl?: string;
  isPremium: boolean;
  qualities?: MediaQuality[];
};

export type UpdateContentInput = {
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
  mediaUrl?: string;
  mediaType?: MediaType;
  thumbnailUrl?: string | null;
  blurDataUrl?: string | null;
  isPremium?: boolean;
  qualities?: MediaQuality[] | null;
};

export type UpdateProfileInput = {
  displayName: string;
  bio: string;
  location: string;
  orientation: Orientation;
  interests: string[];
  avatarUrl?: string;
  preferences: Preferences;
};
