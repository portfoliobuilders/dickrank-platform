export type MediaType = 'IMAGE' | 'VIDEO';
export type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'DELETED';
export type FeedFilter = 'following' | 'popular' | 'new' | 'premium';
export type ContentSort = 'newest' | 'popular';

export interface QualityOption {
  label: string;
  url: string;
}

export interface ScheduleItem {
  id: string;
  title: string;
  startsAt: string;
}

export interface ProfilePreferences {
  showOnlineStatus: boolean;
  allowMessages: boolean;
  hideFromSearch: boolean;
}

export interface CreatorSummary {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  isCreator: boolean;
}

export interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  category: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  mediaType: MediaType;
  qualities: QualityOption[] | null;
  isPremium: boolean;
  status: ContentStatus;
  likeCount: number;
  viewCount: number;
  rating: number;
  createdAt: string;
  creator: CreatorSummary;
  likedByMe: boolean;
  locked: boolean;
}

export interface PublicProfile {
  id: string;
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
  contentCount: number;
  followerCount: number;
  subscribed: boolean;
  isSelf: boolean;
  schedule: ScheduleItem[];
  content: ContentItem[];
}

export interface EditableProfile {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  orientation: string | null;
  interests: string[];
  avatarUrl: string | null;
  isCreator: boolean;
  preferences: ProfilePreferences;
}

export interface SessionUser {
  id: string;
  username: string;
  displayName: string | null;
  ageVerification: boolean;
  isCreator: boolean;
  authUserId: string | null;
}

export interface ContentListResult {
  items: ContentItem[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export const PAGE_SIZE = 12;

export const DEFAULT_PREFERENCES: ProfilePreferences = {
  showOnlineStatus: false,
  allowMessages: true,
  hideFromSearch: false,
};
