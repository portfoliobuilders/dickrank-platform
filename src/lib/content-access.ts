import { z } from "zod";
import {
  contentAccessTypes,
  decideContentAccess,
  type AccessPolicyResult,
  type ContentAccessType,
} from "@/lib/access-policy";
import { subscriptionStatuses, type SubscriptionAccessInput } from "@/lib/subscription-access";
import { getServiceSupabase } from "@/lib/supabase/server";
import type { ContentPreview } from "@/types/access";

const contentRowSchema = z.object({
  id: z.string().uuid(),
  creator_id: z.string().uuid(),
  title: z.string(),
  preview_text: z.string().nullable(),
  thumbnail_url: z.string().nullable(),
  access_type: z.enum(contentAccessTypes),
  price_cents: z.number().int().nullable(),
});

const creatorRowSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  slug: z.string(),
});

const tierRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  price_cents: z.number().int(),
  features: z.preprocess(
    (value) => (Array.isArray(value) ? value.filter((item) => typeof item === "string") : []),
    z.array(z.string()),
  ),
  is_popular: z.boolean(),
});

const subscriptionRowSchema = z.object({
  status: z.enum(subscriptionStatuses),
  end_date: z.string().nullable(),
  payment_failed_at: z.string().nullable(),
});

export interface ContentRecord {
  id: string;
  creatorId: string;
  title: string;
  previewText: string | null;
  thumbnailUrl: string | null;
  accessType: ContentAccessType;
  /** One-time price in cents, mapped from Content.price. */
  price: number | null;
}

export async function getContent(contentId: string): Promise<ContentRecord | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("content")
    .select("id, creator_id, title, preview_text, thumbnail_url, access_type, price_cents")
    .eq("id", contentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = contentRowSchema.parse(data);
  return {
    id: row.id,
    creatorId: row.creator_id,
    title: row.title,
    previewText: row.preview_text,
    thumbnailUrl: row.thumbnail_url,
    accessType: row.access_type,
    price: row.price_cents,
  };
}

async function loadSubscriptions(userId: string, creatorId: string): Promise<SubscriptionAccessInput[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, end_date, payment_failed_at")
    .eq("user_id", userId)
    .eq("creator_id", creatorId);

  if (error) throw new Error(error.message);
  return z.array(subscriptionRowSchema).parse(data ?? []).map((row) => ({
    status: row.status,
    endDate: row.end_date,
    paymentFailedAt: row.payment_failed_at,
  }));
}

async function hasSucceededPurchase(userId: string, contentId: string): Promise<boolean> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("content_id", contentId)
    .eq("status", "succeeded")
    .limit(1);

  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length > 0;
}

export async function resolveContentAccess(input: {
  userId: string | null;
  ageVerified: boolean;
  content: ContentRecord;
  now?: Date;
}): Promise<AccessPolicyResult> {
  const subscriptions = input.userId
    ? await loadSubscriptions(input.userId, input.content.creatorId)
    : [];
  const hasPurchase = input.userId
    ? await hasSucceededPurchase(input.userId, input.content.id)
    : false;

  return decideContentAccess(
    {
      authenticated: Boolean(input.userId),
      ageVerified: input.ageVerified,
      accessType: input.content.accessType,
      price: input.content.price,
      subscriptions,
      hasPurchase,
    },
    input.now,
  );
}

export async function getContentPreview(content: ContentRecord): Promise<ContentPreview> {
  const supabase = getServiceSupabase();
  const [{ data: creatorData, error: creatorError }, { data: tierData, error: tierError }] = await Promise.all([
    supabase
      .from("creators")
      .select("id, display_name, avatar_url, slug")
      .eq("id", content.creatorId)
      .maybeSingle(),
    supabase
      .from("subscription_tiers")
      .select("id, name, price_cents, features, is_popular")
      .eq("creator_id", content.creatorId)
      .order("price_cents", { ascending: true }),
  ]);

  if (creatorError) throw new Error(creatorError.message);
  if (tierError) throw new Error(tierError.message);

  if (!creatorData) throw new Error("creator missing");
  const creator = creatorRowSchema.parse(creatorData);
  const tiers = z.array(tierRowSchema).parse(tierData ?? []);

  return {
    contentId: content.id,
    title: content.title,
    previewText: content.previewText,
    thumbnailUrl: content.thumbnailUrl,
    price: content.price,
    accessType: content.accessType,
    creator: {
      id: creator.id,
      displayName: creator.display_name,
      avatarUrl: creator.avatar_url,
      profilePath: `/creators/${creator.slug}`,
    },
    tiers: tiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      priceCents: tier.price_cents,
      features: tier.features,
      popular: tier.is_popular,
    })),
  };
}
