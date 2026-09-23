"use client";

import { useState } from "react";

export function AccountTools() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  async function exportData() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/user/export-data", { headers: { accept: "application/json" } });
      const body = (await response.json()) as { message?: string; error?: string; jobId?: string };
      if (!response.ok) {
        setError(body.error ?? "Export could not be started");
        return;
      }
      setMessage(`${body.message ?? "Export queued."} Job ${body.jobId ?? ""}.`);
    } catch {
      setError("Export could not be started");
    } finally {
      setBusy(false);
    }
  }

  async function submitDeletion(value: "DELETE" | "CANCEL") {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/user/delete-account", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ confirmation: value }),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setError(body.error ?? "Request failed");
        return;
      }
      setMessage(body.message ?? "Saved");
    } catch {
      setError("Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Your data</h2>
      <p className="muted">
        You can download a copy of your data, or delete the account. Deletion waits 30 days so you can
        cancel. Financial records are kept for 7 years. Audit logs are kept for 1 year after the account
        is deleted.
      </p>
      <button type="button" disabled={busy} onClick={() => void exportData()}>
        Email me a copy of my data
      </button>
      <label htmlFor="confirmation">
        Type DELETE to schedule deletion, or CANCEL to stop a scheduled deletion
      </label>
      <input
        id="confirmation"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        autoComplete="off"
      />
      <button
        type="button"
        className="danger"
        disabled={busy || confirmation !== "DELETE"}
        onClick={() => void submitDeletion("DELETE")}
      >
        Delete my account
      </button>
      <button
        type="button"
        className="ghost"
        disabled={busy || confirmation !== "CANCEL"}
        onClick={() => void submitDeletion("CANCEL")}
      >
        Cancel deletion
      </button>
      {message ? <p className="banner">{message}</p> : null}
      {error ? <p className="banner error">{error}</p> : null}
    </section>
  );
}
