import type { SupabaseClient } from "@supabase/supabase-js";
import { isDemoMode } from "@/lib/demo";
import { demoViewer } from "@/lib/demo-store";
import { ServiceError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Viewer } from "@/types";

const VIEWER_COLUMNS = "id, username, display_name, avatar_url, is_creator, age_verified";

export type AuthContext = {
  supabase: SupabaseClient | null;
  profile: Viewer;
};

export type ViewerContext = {
  supabase: SupabaseClient | null;
  profile: Viewer | null;
};

function mapViewer(row: {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_creator: boolean;
  age_verified: boolean;
}): Viewer {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isCreator: row.is_creator,
    ageVerified: row.age_verified,
  };
}

async function loadViewer(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(VIEWER_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new ServiceError(500, "Could not load your profile");
  return data ? mapViewer(data) : null;
}

export async function getViewer(): Promise<ViewerContext> {
  if (isDemoMode()) return { supabase: null, profile: demoViewer() };

  const supabase = createSupabaseServerClient();
  if (!supabase) return { supabase: null, profile: null };

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, profile: null };
  const profile = await loadViewer(supabase, data.user.id);
  return { supabase, profile };
}

export async function requireVerifiedUser(): Promise<AuthContext> {
  if (isDemoMode()) return { supabase: null, profile: demoViewer() };

  const supabase = createSupabaseServerClient();
  if (!supabase) throw new ServiceError(503, "Database is not configured");

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ServiceError(401, "Sign in required");

  const profile = await loadViewer(supabase, data.user.id);
  if (!profile) throw new ServiceError(403, "Create a profile before continuing");
  if (!profile.ageVerified) throw new ServiceError(403, "Age verification required");
  return { supabase, profile };
}

export async function requireCreator() {
  const auth = await requireVerifiedUser();
  if (!auth.profile.isCreator) throw new ServiceError(403, "Only creators can do that");
  return auth;
}
