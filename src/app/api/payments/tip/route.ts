import { NextResponse } from 'next/server';
import { writeAuditLog } from '@/lib/audit';
import { requireVerifiedUser } from '@/lib/auth';
import { ensureStripeCustomer } from '@/lib/payments/customers';
import { fieldPaths, tipSchema } from '@/lib/payments/schemas';
import { createPaymentIntent } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const parsed = tipSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', fields: fieldPaths(parsed.error) }, { status: 400 });
  }

  const auth = await requireVerifiedUser();
  if ('error' in auth) return auth.error;

  const admin = createAdminClient();
  const { data: creator } = await admin
    .from('creators')
    .select('id, user_id')
    .eq('id', parsed.data.creatorId)
    .maybeSingle();

  if (!creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
  }
  if (creator.user_id === auth.profile.id) {
    return NextResponse.json({ error: 'You cannot tip yourself' }, { status: 400 });
  }

  try {
    const customerId = await ensureStripeCustomer(auth.profile, auth.email);
    const intent = await createPaymentIntent({
      amountCents: parsed.data.amountCents,
      customerId,
      tipperId: auth.profile.id,
      creatorId: creator.id,
      idempotencyKey: parsed.data.idempotencyKey,
      receiptEmail: auth.email,
    });

    const { error } = await admin.from('tips').upsert(
      {
        tipper_id: auth.profile.id,
        creator_id: creator.id,
        amount_cents: parsed.data.amountCents,
        stripe_payment_intent_id: intent.id,
        status: 'pending',
      },
      { onConflict: 'stripe_payment_intent_id' },
    );
    if (error) {
      console.error('tip insert failed', { code: error.code });
      return NextResponse.json({ error: 'Could not record the tip' }, { status: 500 });
    }

    await writeAuditLog({
      actorId: auth.profile.id,
      action: 'create',
      entity: 'tips',
      entityId: intent.id,
      metadata: { creatorId: creator.id, amountCents: parsed.data.amountCents, status: 'pending' },
    });

    // The creator balance is credited when Stripe sends payment_intent.succeeded.
    // Crediting here would count unpaid attempts.
    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
    });
  } catch (error) {
    console.error('tip failed', { message: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Could not start the tip' }, { status: 502 });
  }
}
