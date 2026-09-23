import type { ContentAccessType } from "@/lib/access-policy";

export interface CreatorPreview {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  profilePath: string;
}

export interface TierPreview {
  id: string;
  name: string;
  priceCents: number;
  features: string[];
  popular: boolean;
}

export interface ContentPreview {
  contentId: string;
  title: string;
  previewText: string | null;
  thumbnailUrl: string | null;
  price: number | null;
  accessType: ContentAccessType;
  creator: CreatorPreview;
  tiers: TierPreview[];
}

export interface AccessResponse {
  hasAccess: boolean;
  reason?: string;
  preview?: ContentPreview;
}
