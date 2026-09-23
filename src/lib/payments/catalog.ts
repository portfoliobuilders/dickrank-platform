import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';

export type PublicTier = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  benefits: string[];
};

export type PublicCreator = {
  id: string;
  username: string;
  displayName: string;
  tiers: PublicTier[];
};

const PREVIEW_CREATOR: PublicCreator = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'preview',
  displayName: 'Preview Creator',
  tiers: [
    {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Fan',
      description: 'The monthly feed.',
      priceCents: 999,
      benefits: ['Subscriber feed', 'Monthly post', 'Cancel anytime'],
    },
    {
      id: '00000000-0000-4000-8000-000000000003',
      name: 'Supporter',
      description: 'Closer access and extras.',
      priceCents: 1999,
      benefits: ['Everything in Fan', 'Behind-the-scenes posts', 'Priority replies'],
    },
  ],
};

export function isPreviewCreator(username: string): boolean {
  return process.env.PAYMENTS_UI_PREVIEW === 'true' && username === 'preview';
}

export async function getPublicCreator(username: string): Promise<PublicCreator | null> {
  if (isPreviewCreator(username)) return PREVIEW_CREATOR;
  if (!isSupabaseConfigured()) return null;

  const admin = createAdminClient();
  const { data: creator } = await admin
    .from('creators')
    .select('id, username, display_name')
    .eq('username', username)
    .maybeSingle();

  if (!creator) return null;

  const { data: tiers } = await admin
    .from('subscription_tiers')
    .select('id, name, description, price_cents, benefits')
    .eq('creator_id', creator.id)
    .eq('active', true)
    .order('price_cents', { ascending: true });

  return {
    id: creator.id,
    username: creator.username,
    displayName: creator.display_name || creator.username,
    tiers: (tiers ?? []).map((tier) => ({
      id: tier.id,
      name: tier.name,
      description: tier.description,
      priceCents: tier.price_cents,
      benefits: Array.isArray(tier.benefits) ? tier.benefits.filter((item) => typeof item === 'string') : [],
    })),
  };
}
