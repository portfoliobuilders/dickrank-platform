'use client';

import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ConnectPayoutSetup } from '@/components/payments/ConnectPayoutSetup';
import { formatUsd, MIN_WITHDRAWAL_CENTS } from '@/lib/payments/money';

type Period = 'this_month' | 'last_month' | 'all_time';

type EarningsResponse = {
  period: Period;
  breakdown: { subscriptions: number; tips: number; contentSales: number };
  pendingPayouts: number;
  availableBalance: number;
  activeSubscribers: number;
  payoutReady: boolean;
  series: Array<{ date: string; earningsCents: number; subscriberCount: number }>;
  transactions: Array<{
    id: string;
    type: string;
    amountCents: number;
    netCents: number;
    status: string;
    description: string | null;
    createdAt: string;
  }>;
};

const PREVIEW: EarningsResponse = {
  period: 'this_month',
  breakdown: { subscriptions: 18400, tips: 7500, contentSales: 3200 },
  pendingPayouts: 0,
  availableBalance: 29100,
  activeSubscribers: 42,
  payoutReady: false,
  series: [
    { date: '2026-09-01', earningsCents: 4200, subscriberCount: 36 },
    { date: '2026-09-08', earningsCents: 6100, subscriberCount: 38 },
    { date: '2026-09-15', earningsCents: 5400, subscriberCount: 40 },
    { date: '2026-09-22', earningsCents: 9800, subscriberCount: 42 },
  ],
  transactions: [
    {
      id: 'tx_sub',
      type: 'subscription',
      amountCents: 1999,
      netCents: 1599,
      status: 'completed',
      description: 'Subscription payment',
      createdAt: '2026-09-22T12:00:00.000Z',
    },
    {
      id: 'tx_tip',
      type: 'tip',
      amountCents: 2500,
      netCents: 2000,
      status: 'completed',
      description: 'Tip',
      createdAt: '2026-09-21T12:00:00.000Z',
    },
    {
      id: 'tx_sale',
      type: 'content_sale',
      amountCents: 1500,
      netCents: 1200,
      status: 'completed',
      description: 'Content sale',
      createdAt: '2026-09-20T12:00:00.000Z',
    },
  ],
};

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'all_time', label: 'All time' },
];

export function EarningsDashboard({ preview }: { preview: boolean }) {
  const [period, setPeriod] = useState<Period>('this_month');
  const [data, setData] = useState<EarningsResponse | null>(preview ? PREVIEW : null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!preview);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    if (preview) {
      setData({ ...PREVIEW, period });
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/creator/earnings?period=${period}`)
      .then(async (response) => {
        const body = (await response.json()) as EarningsResponse & { error?: string };
        if (!response.ok) throw new Error(body.error || 'Could not load earnings');
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      })
      .catch((fetchError: Error) => {
        if (!cancelled) setError(fetchError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, preview]);

  async function withdraw() {
    setWithdrawing(true);
    setWithdrawMessage(null);
    try {
      const response = await fetch('/api/payments/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await response.json()) as { error?: string; status?: string; amountCents?: number };
      if (!response.ok) {
        setWithdrawMessage(body.error || 'Could not request the payout');
      } else {
        setWithdrawMessage(`Payout ${body.status}. ${formatUsd(body.amountCents || 0)} is on its way.`);
        setWithdrawOpen(false);
      }
    } catch {
      setWithdrawMessage('Could not request the payout');
    } finally {
      setWithdrawing(false);
    }
  }

  const balance = data?.availableBalance ?? 0;
  const canWithdraw = balance > MIN_WITHDRAWAL_CENTS;

  return (
    <div className="space-y-8">
      {preview ? (
        <p className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
          Preview data. Sign in against a configured database to see live earnings.
        </p>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Creator dashboard</h1>
          <p className="mt-1 text-zinc-400">
            Available balance {formatUsd(balance)}. Pending payouts {formatUsd(data?.pendingPayouts ?? 0)}.
          </p>
        </div>
        <button
          type="button"
          disabled={!canWithdraw || withdrawing}
          onClick={() => setWithdrawOpen(true)}
          className="rounded-lg bg-amber-400 px-4 py-2 font-medium text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Withdraw
        </button>
      </div>
      {!canWithdraw ? <p className="text-sm text-zinc-500">Withdraw is available once your balance is over $100.</p> : null}
      {withdrawMessage ? <p className="text-sm text-zinc-200">{withdrawMessage}</p> : null}

      <div className="flex gap-2">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPeriod(item.id)}
            className={`rounded-full px-3 py-1 text-sm ${
              period === item.id ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-900 text-zinc-300'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="text-sm text-zinc-400">Loading earnings…</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Subscriptions" cents={data?.breakdown.subscriptions ?? 0} />
        <Stat label="Tips" cents={data?.breakdown.tips ?? 0} />
        <Stat label="Content sales" cents={data?.breakdown.contentSales ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Earnings" data={data?.series ?? []} dataKey="earningsCents" money />
        <ChartCard title="Subscribers" data={data?.series ?? []} dataKey="subscriberCount" />
      </div>

      <section className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Net</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(data?.transactions ?? []).map((row) => (
              <tr key={row.id} className="border-t border-zinc-800">
                <td className="px-4 py-3">{row.createdAt.slice(0, 10)}</td>
                <td className="px-4 py-3 capitalize">{row.type.replace('_', ' ')}</td>
                <td className="px-4 py-3">{row.description}</td>
                <td className="px-4 py-3">{formatUsd(row.netCents)}</td>
                <td className="px-4 py-3 capitalize">{row.status}</td>
              </tr>
            ))}
            {(data?.transactions.length ?? 0) === 0 ? (
              <tr>
                <td className="px-4 py-6 text-zinc-500" colSpan={5}>
                  No transactions in this period.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <p className="text-sm text-zinc-400">Active subscribers: {data?.activeSubscribers ?? 0}</p>
      {preview ? null : <ConnectPayoutSetup />}

      {withdrawOpen ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold">Withdraw {formatUsd(balance)}</h2>
            <p className="mt-2 text-sm text-zinc-400">
              This sends your available balance to the bank account you verified with Stripe. Status moves from pending to processing, then completed.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={withdraw}
                disabled={withdrawing}
                className="rounded-lg bg-amber-400 px-4 py-2 font-medium text-zinc-950 disabled:opacity-60"
              >
                {withdrawing ? 'Sending…' : 'Confirm payout'}
              </button>
              <button type="button" onClick={() => setWithdrawOpen(false)} className="px-4 py-2 text-sm text-zinc-300">
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="rounded-2xl border border-zinc-800 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{formatUsd(cents)}</p>
    </div>
  );
}

function ChartCard({
  title,
  data,
  dataKey,
  money,
}: {
  title: string;
  data: Array<{ date: string; earningsCents: number; subscriberCount: number }>;
  dataKey: 'earningsCents' | 'subscriberCount';
  money?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 p-4">
      <h2 className="mb-4 font-medium">{title}</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#27272a" />
            <XAxis dataKey="date" stroke="#a1a1aa" tick={{ fontSize: 12 }} />
            <YAxis
              stroke="#a1a1aa"
              tick={{ fontSize: 12 }}
              tickFormatter={(value: number) => (money ? formatUsd(value) : String(value))}
            />
            <Tooltip
              formatter={(value: number) => (money ? formatUsd(value) : value)}
              contentStyle={{ background: '#18181b', border: '1px solid #3f3f46' }}
            />
            <Line type="monotone" dataKey={dataKey} stroke="#fbbf24" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
