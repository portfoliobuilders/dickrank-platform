const MIN_TIP_CENTS = 100;
const MAX_TIP_CENTS = 50_000;
const MIN_WITHDRAWAL_CENTS = 10_000;

export function platformFeeBps(): number {
  const raw = Number(process.env.PLATFORM_FEE_BPS ?? '2000');
  if (!Number.isFinite(raw) || raw < 0 || raw > 5000) return 2000;
  return Math.round(raw);
}

export function splitAmount(amountCents: number): { feeCents: number; netCents: number } {
  const feeCents = Math.round((amountCents * platformFeeBps()) / 10_000);
  const netCents = amountCents - feeCents;
  return { feeCents, netCents };
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export const TIP_PRESETS_CENTS = [500, 1000, 2500, 5000, 10_000] as const;

export { MIN_TIP_CENTS, MAX_TIP_CENTS, MIN_WITHDRAWAL_CENTS };
