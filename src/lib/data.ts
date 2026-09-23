import { getBackendMode } from '@/lib/backend';
import { createMemoryStore, ensureLocalDemoUser as ensureDemo } from '@/lib/memory-store';
import { createSupabaseStore } from '@/lib/supabase-store';
import type { ContentStore } from '@/lib/store';

let memory: ContentStore | null = null;

export function getStore(): ContentStore {
  const mode = getBackendMode();
  if (mode === 'supabase') return createSupabaseStore();
  if (mode === 'memory') {
    if (!memory) memory = createMemoryStore();
    return memory;
  }
  throw new Error('Data backend is not configured');
}

export function ensureLocalDemoUser() {
  return ensureDemo();
}
