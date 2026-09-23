import { NextResponse } from 'next/server';
import { requireVerifiedUser } from '@/lib/auth';
import { earningsQuerySchema, fieldPaths } from '@/lib/payments/schemas';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type TxRow = {
  id: string;
  type: 'subscription' | 'tip' | 'content_sale' | 'withdrawal';
  amount_cents: number;
  platform_fee_cents: number;
  net_cents: number;
  status: string;
  description: string | null;
  created_at: string;
};

type SubRow = {
  status: string;
  created_at: string;
  canceled_at: string | null;
};

function periodBounds(period: 'this_month' | 'last_month' | 'all_time') {
  const now = new Date();
  if (period === 'all_time') {
    return { start: new Date(0), end: now };
  }
  if (period === 'this_month') {
    return { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end: now };
  }
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
  };
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function eachDay(start: Date, end: Date): string[] {
  const days: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  if (start.getTime() === 0) {
    return [];
  }
  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = earningsQuerySchema.safeParse({ period: url.searchParams.get('period') ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', fields: fieldPaths(parsed.error) }, { status: 400 });
  }

  const auth = await requireVerifiedUser();
  if ('error' in auth) return auth.error;

  const admin = createAdminClient();
  const { data: creator } = await admin
    .from('creators')
    .select('id, bank_account_verified, identity_verified, stripe_account_id')
    .eq('user_id', auth.profile.id)
    .maybeSingle();

  if (!creator) {
    return NextResponse.json({ error: 'Creator account required' }, { status: 403 });
  }

  const { start, end } = periodBounds(parsed.data.period);
  let txQuery = admin
    .from('transactions')
    .select('id, type, amount_cents, platform_fee_cents, net_cents, status, description, created_at')
    .eq('creator_id', creator.id)
    .order('created_at', { ascending: false });

  if (parsed.data.period !== 'all_time') {
    txQuery = txQuery.gte('created_at', start.toISOString()).lt('created_at', end.toISOString());
  }

  const [{ data: transactions, error: txError }, { data: subs }, { data: balance }] = await Promise.all([
    txQuery,
    admin
      .from('subscriptions')
      .select('status, created_at, canceled_at')
      .eq('creator_id', creator.id),
    admin.from('creator_balances').select('balance_cents, pending_cents').eq('creator_id', creator.id).maybeSingle(),
  ]);

  if (txError) {
    console.error('earnings query failed', { code: txError.code });
    return NextResponse.json({ error: 'Could not load earnings' }, { status: 500 });
  }

  const rows = (transactions ?? []) as TxRow[];
  const subscriptions = (subs ?? []) as SubRow[];
  const breakdown = { subscriptions: 0, tips: 0, contentSales: 0 };
  for (const row of rows) {
    if (row.status !== 'completed' || row.net_cents <= 0) continue;
    if (row.type === 'subscription') breakdown.subscriptions += row.net_cents;
    if (row.type === 'tip') breakdown.tips += row.net_cents;
    if (row.type === 'content_sale') breakdown.contentSales += row.net_cents;
  }

  const days = parsed.data.period === 'all_time'
    ? Array.from(new Set(rows.map((row) => dayKey(row.created_at)))).sort()
    : eachDay(start, end);

  const earningsByDay = new Map<string, number>();
  for (const row of rows) {
    if (row.net_cents <= 0 || row.status !== 'completed') continue;
    const key = dayKey(row.created_at);
    earningsByDay.set(key, (earningsByDay.get(key) ?? 0) + row.net_cents);
  }

  const series = days.map((date) => {
    const endOfDay = new Date(`${date}T23:59:59.999Z`).getTime();
    const subscriberCount = subscriptions.filter((sub) => {
      const created = new Date(sub.created_at).getTime();
      if (created > endOfDay) return false;
      if (sub.status === 'canceled' && !sub.canceled_at) return false;
      if (sub.canceled_at && new Date(sub.canceled_at).getTime() <= endOfDay) return false;
      return sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due' || sub.status === 'canceled';
    }).length;
    return {
      date,
      earningsCents: earningsByDay.get(date) ?? 0,
      subscriberCount,
    };
  });

  const activeSubscribers = subscriptions.filter((sub) => sub.status === 'active' || sub.status === 'trialing').length;

  return NextResponse.json({
    period: parsed.data.period,
    breakdown,
    pendingPayouts: balance?.pending_cents ?? 0,
    availableBalance: balance?.balance_cents ?? 0,
    activeSubscribers,
    payoutReady: Boolean(creator.stripe_account_id && creator.identity_verified && creator.bank_account_verified),
    series,
    transactions: rows.slice(0, 20).map((row) => ({
      id: row.id,
      type: row.type,
      amountCents: row.amount_cents,
      netCents: row.net_cents,
      status: row.status,
      description: row.description,
      createdAt: row.created_at,
    })),
  });
}
