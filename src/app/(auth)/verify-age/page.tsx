"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const STEPS = ["Front of ID", "Back of ID", "Selfie", "Submit"] as const;

type Slot = "front" | "back" | "selfie";

export default function VerifyAgePage() {
  const { data: session, status } = useSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<Partial<Record<Slot, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<Slot, string>>>({});
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      Object.values(previews).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
    // Revoke on unmount only. Preview URLs are replaced in setImage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setImage(slot: Slot, file: File | null) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Each image must be 5MB or smaller.");
      return;
    }
    setError(null);
    setFiles((current) => ({ ...current, [slot]: file }));
    setPreviews((current) => {
      const previous = current[slot];
      if (previous) URL.revokeObjectURL(previous);
      return { ...current, [slot]: URL.createObjectURL(file) };
    });
  }

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError("Camera unavailable. Upload a selfie photo instead.");
    }
  }

  function captureSelfie() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setCameraError("Start the camera, then capture your selfie.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Could not capture a frame from the camera.");
      return;
    }
    context.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Could not capture a frame from the camera.");
          return;
        }
        setImage("selfie", new File([blob], "selfie.jpg", { type: "image/jpeg" }));
        streamRef.current?.getTracks().forEach((track) => track.stop());
      },
      "image/jpeg",
      0.9,
    );
  }

  async function submitDocuments() {
    if (!files.front || !files.back || !files.selfie) {
      setError("Add the front of your ID, the back of your ID, and a selfie.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("front", files.front);
      body.set("back", files.back);
      body.set("selfie", files.selfie);
      const response = await fetch("/api/auth/verify-age", { method: "POST", body });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not submit your documents");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return <p className="text-sm text-zinc-400">Loading your account…</p>;
  }

  if (!session?.user) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h1 className="text-xl font-semibold text-white">Sign in to verify your age</h1>
        <Link href="/login?callbackUrl=/verify-age" className="mt-4 inline-flex text-sm font-semibold text-rose-300">
          Go to sign in
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-300">Step {Math.min(step + 1, 4)} of 4</p>
      <h1 className="mt-2 text-xl font-semibold text-white">Upload government ID to verify 18+</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-300">
        Add a photo of the front and back of a government ID, then capture a selfie for manual liveness review. Files
        are encrypted. Submitting places your account in the manual review queue with status pending.
      </p>
      <ol className="mt-4 grid grid-cols-4 gap-2 text-center text-[11px] text-zinc-400">
        {STEPS.map((label, index) => (
          <li key={label} className={index === step ? "text-white" : index < step ? "text-emerald-300" : undefined}>
            {label}
          </li>
        ))}
      </ol>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800" aria-hidden="true">
        <div className="h-full bg-rose-500 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100" role="alert">
          {error}
        </p>
      ) : null}

      {done ? (
        <p className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100" role="status">
          Documents received. Your verification status is pending manual review. Adult areas stay locked until a reviewer approves the check.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {step === 0 ? <IdSlot label="Front of ID" preview={previews.front} onFile={(file) => setImage("front", file)} /> : null}
          {step === 1 ? <IdSlot label="Back of ID" preview={previews.back} onFile={(file) => setImage("back", file)} /> : null}
          {step === 2 ? (
            <div className="space-y-3">
              <video ref={videoRef} className="aspect-video w-full rounded-lg bg-black" playsInline muted />
              {previews.selfie ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews.selfie} alt="Captured selfie preview" className="max-h-48 rounded-lg object-contain" />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={startCamera} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-white">
                  Start camera
                </button>
                <button type="button" onClick={captureSelfie} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-white">
                  Capture selfie
                </button>
              </div>
              {cameraError ? <p className="text-sm text-amber-200">{cameraError}</p> : null}
              <IdSlot label="Or upload a selfie" preview={undefined} onFile={(file) => setImage("selfie", file)} />
            </div>
          ) : null}
          {step === 3 ? (
            <ul className="space-y-2 text-sm text-zinc-200">
              <li>Front of ID: {files.front ? files.front.name : "Missing"}</li>
              <li>Back of ID: {files.back ? files.back.name : "Missing"}</li>
              <li>Selfie: {files.selfie ? "Attached" : "Missing"}</li>
            </ul>
          ) : null}

          <div className="flex gap-2">
            {step > 0 ? (
              <button type="button" onClick={() => setStep((current) => current - 1)} className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-white">
                Back
              </button>
            ) : null}
            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  const required: Slot[] = ["front", "back", "selfie"];
                  const missing = ["the front of your ID", "the back of your ID", "a selfie"][step];
                  if (step < 3 && !files[required[step]]) {
                    setError(`Add ${missing} before continuing.`);
                    return;
                  }
                  setError(null);
                  setStep((current) => current + 1);
                }}
                className="flex-1 rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={submitDocuments}
                disabled={loading}
                className="flex-1 rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
              >
                {loading ? "Uploading…" : "Submit for review"}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function IdSlot({
  label,
  preview,
  onFile,
}: {
  label: string;
  preview?: string;
  onFile: (file: File | null) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-200">
        {label}
      </label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
        className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:text-white"
      />
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="mt-3 max-h-48 rounded-lg object-contain" />
      ) : null}
    </div>
  );
}
