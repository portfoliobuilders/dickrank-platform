export type BackendMode = 'memory' | 'supabase' | 'unconfigured';

export function getBackendMode(): BackendMode {
  if (process.env.DATA_BACKEND === 'memory') {
    if (process.env.NODE_ENV === 'production') return 'unconfigured';
    return 'memory';
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && anon && service) return 'supabase';
  return 'unconfigured';
}
