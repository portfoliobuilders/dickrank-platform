import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

export async function setAgeVerifiedClaim(supabaseId: string, verified: boolean): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  try {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(supabaseId, {
      app_metadata: { age_verified: verified },
    });
  } catch (error) {
    console.error(error instanceof Error ? error.name : 'age claim update failed');
  }
}
