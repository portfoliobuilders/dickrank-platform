"use client";

type UploadPhase = "idle" | "uploading" | "processing" | "success" | "error";

type UploadProgressProps = {
  phase: UploadPhase;
  progress: number;
  errorMessage?: string;
  onCancel: () => void;
  onRetry: () => void;
};

export function UploadProgress({
  phase,
  progress,
  errorMessage,
  onCancel,
  onRetry,
}: UploadProgressProps) {
  if (phase === "idle") return null;

  const label = phase === "uploading"
    ? `Uploading... ${progress}%`
    : phase === "processing"
      ? "Processing..."
      : phase === "success"
        ? "Upload complete. It is waiting for review."
        : errorMessage || "Upload failed.";

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4" role="status" aria-live="polite">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm text-zinc-800">
        <span>{label}</span>
        {phase === "uploading" ? <span className="tabular-nums">{progress}%</span> : null}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
        <div
          className={`h-full rounded-full transition-all ${
            phase === "error" ? "bg-red-600" : phase === "success" ? "bg-emerald-600" : "bg-zinc-900"
          } ${phase === "processing" ? "animate-pulse w-full" : ""}`}
          style={phase === "processing" ? undefined : { width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
      <div className="mt-3 flex gap-2">
        {phase === "uploading" ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 hover:bg-white"
          >
            Cancel upload
          </button>
        ) : null}
        {phase === "error" ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
