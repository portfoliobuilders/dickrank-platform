import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  applyAdminModerationDecision,
  moderationDecisionSchema,
} from '@/lib/admin-moderation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const parsed = moderationDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid decision', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await applyAdminModerationDecision({
      contentId: parsed.data.contentId,
      decision: parsed.data.decision,
      adminId: auth.user.id,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      ok: true,
      contentId: parsed.data.contentId,
      moderationStatus: result.moderationStatus,
    });
  } catch (error) {
    console.error('moderation decision failed', error);
    return NextResponse.json({ error: 'Could not save decision' }, { status: 500 });
  }
}
