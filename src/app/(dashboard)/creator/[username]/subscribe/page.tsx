import { notFound } from 'next/navigation';
import { SubscriptionSuccessTracker } from '@/components/analytics/SubscriptionSuccessTracker';
import { SubscribeButton } from '@/components/payments/SubscribeButton';
import { TipButton } from '@/components/payments/TipButton';
import { getPublicCreator, isPreviewCreator } from '@/lib/payments/catalog';
import { formatUsd } from '@/lib/payments/money';
import { isSupabaseConfigured } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function SubscribePage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams: { status?: string };
}) {
  if (!isSupabaseConfigured() && !isPreviewCreator(params.username)) {
    return (
      <main>
        <h1 className="text-3xl font-semibold">Subscriptions</h1>
        <p className="mt-2 text-zinc-400">Payments are not configured yet.</p>
      </main>
    );
  }

  const creator = await getPublicCreator(params.username);
  if (!creator) notFound();

  return (
    <main className="space-y-8">
      <SubscriptionSuccessTracker active={searchParams.status === 'success'} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-amber-300">18+ subscribers</p>
          <h1 className="text-3xl font-semibold">Subscribe to {creator.displayName}</h1>
          <p className="mt-2 text-zinc-400">Monthly access. Cancel from your Stripe receipt email.</p>
        </div>
        <TipButton creatorId={creator.id} />
      </div>

      {searchParams.status === 'success' ? (
        <p className="rounded-lg bg-emerald-950 px-3 py-3 text-emerald-200">
          Checkout finished. Your subscription is confirmed when Stripe sends the receipt.
        </p>
      ) : null}
      {searchParams.status === 'cancel' ? (
        <p className="rounded-lg bg-zinc-900 px-3 py-3 text-zinc-300">Checkout was canceled. You have not been charged.</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {creator.tiers.map((tier) => (
          <article key={tier.id} className="flex flex-col rounded-2xl border border-zinc-800 p-5">
            <h2 className="text-xl font-semibold">{tier.name}</h2>
            <p className="mt-2 text-3xl font-semibold">
              {formatUsd(tier.priceCents)}
              <span className="text-base font-normal text-zinc-400"> / month</span>
            </p>
            {tier.description ? <p className="mt-2 text-sm text-zinc-400">{tier.description}</p> : null}
            <ul className="mt-4 flex-1 space-y-2 text-sm text-zinc-200">
              {tier.benefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
            <div className="mt-6">
              <SubscribeButton
                creatorId={creator.id}
                tierId={tier.id}
                tierName={tier.name}
                price={tier.priceCents / 100}
              />
            </div>
          </article>
        ))}
      </div>

      {creator.tiers.length === 0 ? <p className="text-zinc-400">This creator has no active tiers yet.</p> : null}

      <p className="flex items-center gap-2 text-sm text-zinc-400">
        <LockIcon />
        Secure checkout by Stripe. Card numbers stay with Stripe and are never stored here.
      </p>
    </main>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1zm2 0h6V8a3 3 0 0 0-6 0v2z" />
    </svg>
  );
}
