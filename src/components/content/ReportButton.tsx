"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { REPORT_REASONS } from "@/lib/constants";

export function ReportButton({ contentId }: { contentId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]["value"]>("spam");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/content/${contentId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; duplicate?: boolean };
      if (!response.ok) throw new Error(body.error || "Could not send report");
      setMessage(body.duplicate ? "You already reported this." : "Report sent. Thank you.");
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send report");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="danger" onClick={() => setOpen((value) => !value)}>
        Report
      </Button>
      {open ? (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900 p-3">
          <label className="block text-sm text-zinc-300">
            Reason
            <select
              className="mt-1 w-full rounded-lg bg-zinc-800 px-3 py-2 text-white"
              value={reason}
              onChange={(event) => setReason(event.target.value as typeof reason)}
            >
              {REPORT_REASONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-zinc-300">
            Details
            <textarea
              className="mt-1 w-full rounded-lg bg-zinc-800 px-3 py-2 text-white"
              rows={3}
              maxLength={1000}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
            />
          </label>
          <Button onClick={() => void submit()} disabled={pending}>
            {pending ? "Sending" : "Submit report"}
          </Button>
        </div>
      ) : null}
      {message ? <p className="text-xs text-zinc-300">{message}</p> : null}
    </div>
  );
}
