import { z } from 'zod';
import { setMemorySession, startLocalSession, getSessionUser } from '@/lib/auth';
import { getBackendMode } from '@/lib/backend';
import { getStore } from '@/lib/data';
import { ApiError } from '@/lib/errors';
import { safeNextPath } from '@/lib/format';
import { handle, json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  confirmed: z.literal(true),
  next: z.string().optional(),
});

export async function POST(request: Request) {
  return handle(async () => {
    const mode = getBackendMode();
    if (mode === 'unconfigured') {
      throw new ApiError(503, 'Data backend is not configured');
    }
    const body = bodySchema.parse(await request.json());
    const existing = mode === 'memory' ? await startLocalSession() : await getSessionUser();
    if (!existing) throw new ApiError(401, 'Sign in required before age verification');
    const user = await getStore().confirmAge(existing.id);
    if (user.ageVerification !== true) throw new ApiError(403, 'Age verification required');
    if (mode === 'memory') setMemorySession(user.id);
    return json({ ok: true, next: safeNextPath(body.next) });
  });
}
