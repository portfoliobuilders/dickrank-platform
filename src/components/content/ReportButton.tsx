'use client';

import { useState } from 'react';
import { REPORT_REASONS } from '@/lib/validators';

const LABELS: Record<(typeof REPORT_REASONS)[number], string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  copyright: 'Copyright',
  non_consensual: 'Non-consensual',
  underage: 'Someone appears to be under 18',
  other: 'Other',
};

export function ReportButton({ contentId }: { contentId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]>('spam');
  const [details, setDetails] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    try {
      const response = await fetch(`/api/content/${contentId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, details }),
      });
      const body = (await response.json()) as { alreadyReported?: boolean; error?: string };
      if (response.status === 401 || response.status === 403) {
        window.location.href = '/age-verification';
        return;
      }
      if (!response.ok) throw new Error(body.error || 'Could not send report');
      setMessage(body.alreadyReported ? 'You already reported this.' : 'Report submitted.');
      setOpen(false);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not send report');
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full bg-zinc-800 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-700"
      >
        Report
      </button>
      {open ? (
        <form onSubmit={(event) => void submit(event)} className="mt-3 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
          <label className="block text-sm text-zinc-300">
            Reason
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as (typeof REPORT_REASONS)[number])}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            >
              {REPORT_REASONS.map((value) => (
                <option key={value} value={value}>
                  {LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-zinc-300">
            Details
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={500}
              rows={3}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? 'Sending…' : 'Submit report'}
          </button>
        </form>
      ) : null}
      {message ? <p className="mt-2 text-sm text-zinc-300">{message}</p> : null}
    </div>
  );
}
