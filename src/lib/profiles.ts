import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "@/lib/audit";
import { DEFAULT_PREFERENCES } from "@/lib/constants";
import { decryptJson, encryptJson } from "@/lib/encryption";
import {
  demoConfirmAge,
  demoGetOwnProfile,
  demoGetPublicProfile,
  demoListSchedule,
  demoToggleSubscription,
  demoUpdateOwnProfile,
} from "@/lib/demo-store";
import { isDemoMode } from "@/lib/demo";
import { ServiceError } from "@/lib/errors";
import { containsProhibitedContent } from "@/lib/safety";
import { preferencesSchema } from "@/lib/validators";
import type { OwnProfile, Preferences, PublicProfile, ScheduleItem, UpdateProfileInput, Viewer } from "@/types";

const PUBLIC_COLUMNS =
  "id, username, display_name, bio, location, orientation, interests, avatar_url, is_creator, is_verified, is_private, accepts_subscriptions, content_count, follower_count";

function rejectProfileCopy(input: UpdateProfileInput) {
  if (containsProhibitedContent(input.displayName, input.bio, input.location, input.interests)) {
    throw new ServiceError(400, "This profile can't be saved");
  }
}

export async function getPublicProfile(
  supabase: SupabaseClient | null,
  username: string,
  viewerId: string,
): Promise<PublicProfile | null> {
  if (isDemoMode()) return demoGetPublicProfile(username, viewerId);
  if (!supabase) throw new ServiceError(503, "Database is not configured");

  const { data: profileId, error: lookupError } = await supabase.rpc("profile_id_for_username", {
    p_username: username,
  });
  if (lookupError) throw new ServiceError(500, "Could not load that profile");
  if (!profileId) return null;

  const { data, error } = await supabase.from("profiles").select(PUBLIC_COLUMNS).eq("id", profileId).maybeSingle();
  if (error) throw new ServiceError(500, "Could not load that profile");
  if (!data) return null;

  const { data: subscription } = await supabase
    .from("creator_subscriptions")
    .select("status")
    .eq("subscriber_id", viewerId)
    .eq("creator_id", data.id)
    .eq("status", "active")
    .maybeSingle();

  const isOwner = data.id === viewerId;
  const hideDetails = Boolean(data.is_private) && !isOwner;

  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    bio: data.bio,
    location: hideDetails ? null : data.location,
    orientation: hideDetails ? null : data.orientation,
    interests: hideDetails ? [] : (data.interests ?? []),
    avatarUrl: data.avatar_url,
    isCreator: data.is_creator,
    isVerified: data.is_verified,
    isPrivate: data.is_private,
    contentCount: data.content_count,
    followerCount: data.follower_count,
    acceptsSubscriptions: data.accepts_subscriptions,
    viewerSubscribed: Boolean(subscription),
    isOwner,
  };
}

export async function listSchedule(supabase: SupabaseClient | null, username: string): Promise<ScheduleItem[]> {
  if (isDemoMode()) return demoListSchedule(username);
  if (!supabase) throw new ServiceError(503, "Database is not configured");

  const { data: profileId, error: lookupError } = await supabase.rpc("profile_id_for_username", {
    p_username: username,
  });
  if (lookupError) throw new ServiceError(500, "Could not load the schedule");
  if (!profileId) return [];

  const { data, error } = await supabase
    .from("creator_schedule")
    .select("id, title, description, starts_at")
    .eq("creator_id", profileId)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  if (error) throw new ServiceError(500, "Could not load the schedule");

  return (data ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    startsAt: item.starts_at,
  }));
}

async function readOwnPreferences(supabase: SupabaseClient): Promise<Preferences> {
  const { data, error } = await supabase.rpc("own_preferences_ciphertext");
  if (error) throw new ServiceError(500, "Could not load preferences");
  if (!data) return { ...DEFAULT_PREFERENCES };
  try {
    const parsed = preferencesSchema.parse(decryptJson(String(data)));
    return parsed;
  } catch {
    throw new ServiceError(500, "Preferences could not be decrypted");
  }
}

export async function getOwnProfile(supabase: SupabaseClient | null, viewer: Viewer): Promise<OwnProfile> {
  if (isDemoMode()) return demoGetOwnProfile();
  if (!supabase) throw new ServiceError(503, "Database is not configured");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, location, orientation, interests, avatar_url, is_creator, is_verified")
    .eq("id", viewer.id)
    .maybeSingle();
  if (error) throw new ServiceError(500, "Could not load your profile");
  if (!data) throw new ServiceError(404, "Profile not found");

  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    bio: data.bio ?? "",
    location: data.location ?? "",
    orientation: data.orientation ?? "undisclosed",
    interests: data.interests ?? [],
    avatarUrl: data.avatar_url,
    isCreator: data.is_creator,
    isVerified: data.is_verified,
    preferences: await readOwnPreferences(supabase),
  };
}

export async function updateOwnProfile(supabase: SupabaseClient | null, viewer: Viewer, input: UpdateProfileInput) {
  rejectProfileCopy(input);
  const interests = [...new Set(input.interests)];
  const next = { ...input, interests };

  if (isDemoMode()) {
    const previousAvatar = demoGetOwnProfile().avatarUrl;
    const profile = demoUpdateOwnProfile(next);
    const avatarChanged = Boolean(next.avatarUrl) && next.avatarUrl !== previousAvatar;
    await writeAudit(null, {
      actorId: viewer.id,
      action: "profile.update",
      entityType: "profile",
      entityId: viewer.id,
      metadata: { fields: Object.keys(next) },
    });
    if (avatarChanged) {
      await writeAudit(null, {
        actorId: viewer.id,
        action: "profile.avatar_upload",
        entityType: "profile",
        entityId: viewer.id,
        metadata: {},
      });
    }
    return profile;
  }
  if (!supabase) throw new ServiceError(503, "Database is not configured");

  const { data: current, error: currentError } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", viewer.id)
    .maybeSingle();
  if (currentError || !current) throw new ServiceError(500, "Could not update your profile");

  const ciphertext = encryptJson(next.preferences);
  const { error: preferenceError } = await supabase.rpc("save_encrypted_preferences", {
    p_ciphertext: ciphertext,
    p_is_private: next.preferences.privateAccount,
    p_accepts_subscriptions: next.preferences.allowSubscriptions,
  });
  if (preferenceError) throw new ServiceError(500, "Could not encrypt preferences");

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: next.displayName,
      bio: next.bio,
      location: next.location,
      orientation: next.orientation,
      interests,
      avatar_url: next.avatarUrl ? next.avatarUrl : undefined,
    })
    .eq("id", viewer.id);
  if (error) throw new ServiceError(500, "Could not update your profile");

  await writeAudit(supabase, {
    actorId: viewer.id,
    action: "profile.update",
    entityType: "profile",
    entityId: viewer.id,
    metadata: { fields: Object.keys(next) },
  });

  if (next.avatarUrl && next.avatarUrl !== current.avatar_url) {
    await writeAudit(supabase, {
      actorId: viewer.id,
      action: "profile.avatar_upload",
      entityType: "profile",
      entityId: viewer.id,
      metadata: {},
    });
  }

  return getOwnProfile(supabase, viewer);
}

export async function toggleSubscription(supabase: SupabaseClient | null, viewer: Viewer, username: string) {
  if (isDemoMode()) {
    try {
      const result = demoToggleSubscription(viewer.id, username);
      await writeAudit(null, {
        actorId: viewer.id,
        action: result.subscribed ? "subscription.create" : "subscription.cancel",
        entityType: "subscription",
        entityId: username,
        metadata: {},
      });
      return result;
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status) throw new ServiceError(status, error instanceof Error ? error.message : "Could not update subscription");
      throw error;
    }
  }
  if (!supabase) throw new ServiceError(503, "Database is not configured");

  const { data: creatorId, error: lookupError } = await supabase.rpc("profile_id_for_username", {
    p_username: username,
  });
  if (lookupError) throw new ServiceError(500, "Could not update subscription");
  if (!creatorId) throw new ServiceError(404, "Creator not found");

  const { data: creator, error: creatorError } = await supabase
    .from("profiles")
    .select("id, is_creator, accepts_subscriptions")
    .eq("id", creatorId)
    .maybeSingle();
  if (creatorError || !creator) throw new ServiceError(404, "Creator not found");
  if (!creator.is_creator) throw new ServiceError(400, "This member is not a creator");
  if (creator.id === viewer.id) throw new ServiceError(400, "You cannot subscribe to yourself");
  if (!creator.accepts_subscriptions) throw new ServiceError(403, "This creator is not taking subscriptions");

  const { data: existing, error: existingError } = await supabase
    .from("creator_subscriptions")
    .select("status")
    .eq("subscriber_id", viewer.id)
    .eq("creator_id", creator.id)
    .maybeSingle();
  if (existingError) throw new ServiceError(500, "Could not update subscription");

  const active = existing?.status === "active";
  if (active) {
    const { error } = await supabase
      .from("creator_subscriptions")
      .update({ status: "cancelled" })
      .eq("subscriber_id", viewer.id)
      .eq("creator_id", creator.id);
    if (error) throw new ServiceError(500, "Could not update subscription");
    await supabase.from("follows").delete().eq("follower_id", viewer.id).eq("creator_id", creator.id);
  } else if (existing) {
    const { error } = await supabase
      .from("creator_subscriptions")
      .update({ status: "active" })
      .eq("subscriber_id", viewer.id)
      .eq("creator_id", creator.id);
    if (error) throw new ServiceError(500, "Could not update subscription");
    await supabase.from("follows").upsert({ follower_id: viewer.id, creator_id: creator.id });
  } else {
    const { error } = await supabase.from("creator_subscriptions").insert({
      subscriber_id: viewer.id,
      creator_id: creator.id,
      status: "active",
    });
    if (error) throw new ServiceError(500, "Could not update subscription");
    await supabase.from("follows").upsert({ follower_id: viewer.id, creator_id: creator.id });
  }

  const { data: followerCount, error: countError } = await supabase.rpc("set_follower_count", {
    p_creator_id: creator.id,
  });
  if (countError) throw new ServiceError(500, "Could not update follower count");

  await writeAudit(supabase, {
    actorId: viewer.id,
    action: active ? "subscription.cancel" : "subscription.create",
    entityType: "subscription",
    entityId: creator.id,
    metadata: {},
  });

  return { subscribed: !active, followerCount: Number(followerCount ?? 0) };
}

export async function confirmAge(supabase: SupabaseClient | null, viewerId: string | null) {
  if (isDemoMode()) {
    const result = demoConfirmAge();
    await writeAudit(null, {
      actorId: viewerId ?? "demo",
      action: "profile.age_verification",
      entityType: "profile",
      entityId: viewerId ?? "demo",
      metadata: {},
    });
    return result;
  }
  if (!supabase) throw new ServiceError(503, "Database is not configured");
  if (!viewerId) throw new ServiceError(401, "Sign in required");

  const { data, error } = await supabase.rpc("confirm_age_verification");
  if (error) throw new ServiceError(500, "Could not save age verification");
  if (!data) throw new ServiceError(409, "Create a profile before verifying your age");

  await writeAudit(supabase, {
    actorId: viewerId,
    action: "profile.age_verification",
    entityType: "profile",
    entityId: viewerId,
    metadata: {},
  });

  return { ageVerified: true };
}
