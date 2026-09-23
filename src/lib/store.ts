import type {
  ContentItem,
  ContentListResult,
  EditableProfile,
  PublicProfile,
  SessionUser,
} from '@/lib/types';
import type { CreateContentInput, UpdateContentInput, UpdateProfileInput } from '@/lib/validators';

export interface ListContentParams {
  category?: string;
  tags?: string[];
  sort: 'newest' | 'popular';
  page: number;
  pageSize: number;
  premiumOnly?: boolean;
  followingOnly?: boolean;
  creatorUsername?: string;
}

export interface ContentStore {
  getUserById(id: string): Promise<SessionUser | null>;
  getUserByAuthId(authUserId: string): Promise<SessionUser | null>;
  confirmAge(userId: string): Promise<SessionUser>;
  listContent(params: ListContentParams, viewerId: string | null): Promise<ContentListResult>;
  getContent(
    id: string,
    viewerId: string | null,
    options?: { countView?: boolean },
  ): Promise<ContentItem | null>;
  relatedContent(id: string, viewerId: string | null): Promise<ContentItem[]>;
  createContent(userId: string, input: CreateContentInput): Promise<ContentItem>;
  updateContent(userId: string, id: string, input: UpdateContentInput): Promise<ContentItem>;
  softDeleteContent(userId: string, id: string): Promise<void>;
  toggleLike(userId: string, contentId: string): Promise<{ liked: boolean; likeCount: number }>;
  getCreator(username: string, viewerId: string | null): Promise<PublicProfile | null>;
  getEditableProfile(userId: string): Promise<EditableProfile | null>;
  updateProfile(userId: string, input: UpdateProfileInput): Promise<EditableProfile>;
  setAvatar(userId: string, avatarUrl: string): Promise<string>;
  toggleSubscribe(
    userId: string,
    username: string,
  ): Promise<{ subscribed: boolean; followerCount: number }>;
  reportContent(
    userId: string,
    contentId: string,
    reason: string,
    details?: string,
  ): Promise<{ alreadyReported: boolean }>;
}

export type AuditAction = 'create' | 'update' | 'delete' | 'upload';

export interface AuditEntry {
  id: string;
  userId: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
