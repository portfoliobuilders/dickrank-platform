export type BackendMode = 'memory' | 'supabase' | 'unconfigured';

export function getBackendMode(): BackendMode {
  if (process.env.DATA_BACKEND === 'memory') return 'memory';
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return 'supabase';
  }
  return 'unconfigured';
}
