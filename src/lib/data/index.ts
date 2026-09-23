import { getBackendMode } from '@/lib/backend';
import { ApiError } from '@/lib/errors';
import { createMemoryStore, ensureDemoUser } from '@/lib/data/memory';
import { createSupabaseStore } from '@/lib/data/supabase';
import type { ContentStore } from '@/lib/data/types';

let memoryStore: ContentStore | null = null;
let supabaseStore: ContentStore | null = null;

export function getStore(): ContentStore {
  const mode = getBackendMode();
  if (mode === 'memory') {
    memoryStore ??= createMemoryStore();
    return memoryStore;
  }
  if (mode === 'supabase') {
    supabaseStore ??= createSupabaseStore();
    return supabaseStore;
  }
  throw new ApiError(503, 'Data backend is not configured');
}

export function ensureLocalDemoUser() {
  if (getBackendMode() !== 'memory') {
    throw new ApiError(400, 'Demo sign-in is only available when DATA_BACKEND=memory');
  }
  return ensureDemoUser();
}

export type { ContentStore, ListContentParams } from '@/lib/data/types';
