import { getSessionUser, requireApiUser, setMemorySession, startLocalSession } from '@/lib/auth';
import { getBackendMode } from '@/lib/backend';
import { getStore } from '@/lib/data';
import { ApiError } from '@/lib/errors';
import { safeNextPath } from '@/lib/format';
import { handle, json } from '@/lib/http';
import { ageConfirmSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handle(async () => {
    const mode = getBackendMode();
    if (mode === 'unconfigured') throw new ApiError(503, 'Data backend is not configured');
    const input = ageConfirmSchema.parse(await request.json());
    const next = safeNextPath(input.next);

    if (mode === 'memory') {
      const session = await startLocalSession();
      const user = await getStore().confirmAge(session.id);
      setMemorySession(user.id);
      return json({ ok: true, next, ageVerification: user.ageVerification });
    }

    const user = (await getSessionUser()) ?? (await requireApiUser());
    if (user.ageVerification === true) {
      return json({ ok: true, next, ageVerification: true });
    }
    throw new ApiError(
      403,
      'Age verification is still pending. A reviewer has to approve your ID before adult pages open.',
    );
  });
}
