"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";

type AgeVerificationModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AgeVerificationModal({ open, onClose }: AgeVerificationModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="presentation">
      <button
        type="button"
        aria-label="Close age verification dialog"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">Adults only</p>
        <h2 id={titleId} className="mt-2 text-2xl font-semibold text-white">
          Verify your age to continue
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-300">
          This area is limited to people 18 and older. Upload a government ID and a selfie so a reviewer can confirm
          your age before you continue.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/verify-age"
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400"
          >
            Verify your age to continue
          </Link>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-900"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
