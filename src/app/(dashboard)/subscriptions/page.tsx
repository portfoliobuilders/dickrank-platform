import { z } from "zod";
import { SubscriptionList, type SubscriptionView } from "@/components/subscriptions/SubscriptionList";
import { getCurrentUser } from "@/lib/auth";
import { hasSubscriptionAccess, subscriptionStatuses } from "@/lib/subscription-access";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const subscriptionListSchema = z.array(
  z.object({
    id: z.string().uuid(),
    status: z.enum(subscriptionStatuses),
    amount_cents: z.number().int(),
    renewal_date: z.string().nullable(),
    end_date: z.string().nullable(),
    payment_failed_at: z.string().nullable(),
    creators: z.union([
      z.object({
        display_name: z.string(),
        slug: z.string(),
      }),
      z.array(
        z.object({
          display_name: z.string(),
          slug: z.string(),
        }),
      ),
    ]),
  }),
);

export default async function SubscriptionsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main>
        <h1 className="text-3xl font-semibold">Subscriptions</h1>
        <p className="mt-4 text-zinc-300">Account services are not configured yet.</p>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return (
      <main>
        <h1 className="text-3xl font-semibold">Subscriptions</h1>
        <p className="mt-4 text-zinc-300">Sign in to see the creators you support.</p>
        <a href="/login" className="mt-6 inline-flex rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950">
          Sign in
        </a>
      </main>
    );
  }

  if (!user.ageVerified) {
    return (
      <main>
        <h1 className="text-3xl font-semibold">Subscriptions</h1>
        <p className="mt-4 text-zinc-300">Verify that you are 18 or older before managing subscriptions.</p>
        <a href="/verify-age" className="mt-6 inline-flex rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950">
          Verify age
        </a>
      </main>
    );
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, status, amount_cents, renewal_date, end_date, payment_failed_at, creators(display_name, slug)")
    .eq("user_id", user.id)
    .in("status", ["ACTIVE", "CANCELLED", "PAST_DUE"]);

  if (error) {
    console.error("subscription list failed", error.message);
    return (
      <main>
        <h1 className="text-3xl font-semibold">Subscriptions</h1>
        <p className="mt-4 text-zinc-300">We couldn't load your subscriptions. Try again in a moment.</p>
      </main>
    );
  }

  const parsed = subscriptionListSchema.safeParse(data ?? []);
  const subscriptions: SubscriptionView[] = parsed.success
    ? parsed.data
        .map((row) => {
          const creator = Array.isArray(row.creators) ? row.creators[0] : row.creators;
          return {
            id: row.id,
            creatorName: creator?.display_name ?? "Creator",
            creatorPath: creator ? `/creators/${creator.slug}` : "/creators",
            amountCents: row.amount_cents,
            status: row.status,
            renewalDate: row.renewal_date,
            endDate: row.end_date,
            paymentFailedAt: row.payment_failed_at,
          };
        })
        .filter((subscription) =>
          hasSubscriptionAccess({
            status: subscription.status,
            endDate: subscription.endDate,
            paymentFailedAt: subscription.paymentFailedAt,
          }).allowed,
        )
    : [];

  return (
    <main>
      <h1 className="text-3xl font-semibold">Subscriptions</h1>
      <p className="mt-2 mb-6 text-zinc-400">Plans that still grant access, including the 3-day grace period after a failed payment.</p>
      {parsed.success ? (
        <SubscriptionList subscriptions={subscriptions} />
      ) : (
        <p className="text-zinc-300">We couldn't read your subscription records.</p>
      )}
    </main>
  );
}
