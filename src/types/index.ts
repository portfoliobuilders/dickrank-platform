export type UserRole = 'USER' | 'CREATOR' | 'MODERATOR' | 'ADMIN';

export type MediaType = 'IMAGE' | 'VIDEO';

export type ScanStatus = 'PENDING' | 'CLEAN' | 'INFECTED' | 'FAILED';

export type ContentVisibility = 'PUBLIC' | 'SUBSCRIBERS' | 'PRIVATE';

export type SubscriptionStatus =
  | 'INCOMPLETE'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'UNPAID';

export type EventKind = 'COMPETITION' | 'PARTY';

export type ApiErrorBody = {
  error: string;
  code?: string;
  issues?: unknown;
};

export type UploadResponse = {
  content: {
    id: string;
    title: string;
    scanStatus: ScanStatus;
    mediaPath: string;
    visibility: ContentVisibility;
  };
};

export type RateResponse = {
  rating: {
    id: string;
    score: number;
    contentId: string;
  };
  averageScore: number;
  ratingCount: number;
  updated: boolean;
};

export type LeaderboardEntry = {
  rank: number;
  id: string;
  title: string;
  subtitle: string;
  averageScore: number;
  ratingCount: number;
  canRate: boolean;
  viewerScore: number | null;
};

export type LeaderboardResponse = {
  kind: 'content' | 'creators';
  generatedAt: string;
  entries: LeaderboardEntry[];
};

export type ProfileCardData = {
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  role: UserRole;
  ageVerified: boolean;
  contentCount: number;
  subscriberCount: number;
  averageScore: number | null;
};

export type AuthSyncResponse = {
  ageVerification: boolean;
};

export type AgeVerifyResponse = {
  ageVerification: boolean;
};

export type PublicEvent = {
  id: string;
  title: string;
  description: string | null;
  kind: EventKind;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  capacity: number | null;
  hostName: string;
  rsvpCount: number;
};
