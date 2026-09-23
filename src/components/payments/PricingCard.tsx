import Link from "next/link";
import { formatUsd } from "@/lib/format";

export interface PricingCardProps {
  name: string;
  priceCents: number;
  features: string[];
  popular?: boolean;
  ctaLabel: string;
  href?: string;
  onCta?: () => void;
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400">
      <path
        fill="currentColor"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.2 7.2a1 1 0 0 1-1.4 0L3.3 9.1a1 1 0 1 1 1.4-1.4l3.1 3.1 6.5-6.5a1 1 0 0 1 1.4 0Z"
      />
    </svg>
  );
}

function buttonClass(popular: boolean): string {
  const base = "mt-6 inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold";
  return popular
    ? `${base} bg-amber-400 text-zinc-950 hover:bg-amber-300`
    : `${base} bg-zinc-100 text-zinc-950 hover:bg-white`;
}

export function PricingCard({
  name,
  priceCents,
  features,
  popular = false,
  ctaLabel,
  href,
  onCta,
}: PricingCardProps) {
  return (
    <article
      className={`relative flex h-full flex-col rounded-2xl border p-6 ${
        popular ? "border-amber-400 bg-zinc-900 shadow-lg shadow-amber-500/10" : "border-zinc-800 bg-zinc-900/80"
      }`}
    >
      {popular ? (
        <p className="absolute -top-3 left-6 rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-950">
          Most popular
        </p>
      ) : null}
      <h3 className="text-lg font-semibold text-white">{name}</h3>
      <p className="mt-3 text-3xl font-semibold text-white">
        {formatUsd(priceCents)}
        <span className="text-sm font-normal text-zinc-400"> / month</span>
      </p>
      <ul className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-zinc-200">
            <CheckIcon />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {href ? (
        <Link href={href} className={buttonClass(popular)}>
          {ctaLabel}
        </Link>
      ) : (
        <button type="button" onClick={onCta} className={buttonClass(popular)}>
          {ctaLabel}
        </button>
      )}
    </article>
  );
}
