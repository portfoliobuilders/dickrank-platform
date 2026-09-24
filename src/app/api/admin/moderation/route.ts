import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { listModerationQueue, moderationStatusTabSchema } from '@/lib/admin-moderation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const statusParam = request.nextUrl.searchParams.get('status') ?? 'pending';
  const parsed = moderationStatusTabSchema.safeParse(statusParam);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
  }

  try {
    const data = await listModerationQueue(parsed.data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('moderation queue failed', error);
    return NextResponse.json({ error: 'Could not load moderation queue' }, { status: 500 });
  }
}
