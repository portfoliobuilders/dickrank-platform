import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  ageVerified: boolean;
}

const profileSchema = z.object({
  age_verified: z.boolean(),
});

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("age_verified")
    .eq("id", data.user.id)
    .maybeSingle();

  const parsed = profileSchema.safeParse(profile);
  return {
    id: data.user.id,
    ageVerified: parsed.success ? parsed.data.age_verified === true : false,
  };
}
