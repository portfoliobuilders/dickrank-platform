'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const STEPS = ['Front of ID', 'Back of ID', 'Live selfie'] as const;
const MAX_BYTES = 4 * 1024 * 1024;

type IdVerificationFormProps = {
  onComplete?: () => void;
};

export function IdVerificationForm({ onComplete }: IdVerificationFormProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState(0);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function takeFile(file: File | undefined, setter: (file: File) => void) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Use a photo, not a document or video.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Each photo must be 4 MB or smaller.');
      return;
    }
    setError(null);
    setter(file);
  }

  async function startCamera() {
    setError(null);
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      window.setTimeout(() => setCameraReady(true), 1500);
    } catch {
      setError('Allow the camera so we can take a live photo. A file upload is not accepted here.');
    }
  }

  function captureSelfie() {
    const video = videoRef.current;
    if (!video || !cameraReady) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const context = canvas.getContext('2d');
    if (!context) {
      setError('Could not capture the camera frame.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('Could not capture the camera frame.');
          return;
        }
        if (selfieUrl) URL.revokeObjectURL(selfieUrl);
        setSelfie(blob);
        setSelfieUrl(URL.createObjectURL(blob));
        setError(null);
      },
      'image/jpeg',
      0.9,
    );
  }

  async function submit() {
    if (!front || !back || !selfie) {
      setError('Add the front, the back, and a live selfie.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = new FormData();
      body.set('front', front);
      body.set('back', back);
      body.set('selfie', new File([selfie], 'selfie.jpg', { type: 'image/jpeg' }));
      const response = await fetch('/api/auth/verify-age', { method: 'POST', body });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? 'Could not submit your ID.');
        return;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setQueued(true);
      onComplete?.();
    } catch {
      setError('Could not submit your ID. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (queued) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Your ID is in the review queue. DickRank stays locked until a reviewer confirms you are 18 or older.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <ol className="grid grid-cols-3 gap-2 text-xs" aria-label="Verification progress">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? 'step' : undefined}
            className={`rounded-md border px-2 py-2 text-center ${step === index ? 'border-primary text-foreground' : 'text-muted-foreground'}`}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <FileStep
          id="id-front"
          label="Front of your government ID"
          file={front}
          onFile={(file) => takeFile(file, setFront)}
        />
      ) : null}
      {step === 1 ? (
        <FileStep
          id="id-back"
          label="Back of your government ID"
          file={back}
          onFile={(file) => takeFile(file, setBack)}
        />
      ) : null}
      {step === 2 ? (
        <div className="space-y-3">
          <Label htmlFor="selfie-preview">Live selfie</Label>
          <p className="text-sm text-muted-foreground">
            Look at the camera. We capture a live frame for the reviewer. This step does not accept a saved photo.
          </p>
          <video id="selfie-preview" ref={videoRef} className="w-full rounded-md bg-black" playsInline muted />
          {selfieUrl ? (
          // Camera frames are blob URLs. next/image cannot optimize those.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selfieUrl} alt="Captured selfie preview" className="w-full rounded-md" />
        ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={startCamera}>
              Start camera
            </Button>
            <Button type="button" onClick={captureSelfie} disabled={!cameraReady}>
              {cameraReady ? 'Capture selfie' : 'Wait for the camera'}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" disabled={step === 0 || submitting} onClick={() => setStep((value) => value - 1)}>
          Back
        </Button>
        {step < 2 ? (
          <Button
            type="button"
            disabled={(step === 0 && !front) || (step === 1 && !back)}
            onClick={() => setStep((value) => value + 1)}
          >
            Continue
          </Button>
        ) : (
          <Button type="button" disabled={!selfie || submitting} aria-busy={submitting} onClick={submit}>
            {submitting ? 'Submitting…' : 'Submit for review'}
          </Button>
        )}
      </div>
    </div>
  );
}

function FileStep({
  id,
  label,
  file,
  onFile,
}: {
  id: string;
  label: string;
  file: File | null;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="block w-full text-sm"
        onChange={(event) => onFile(event.target.files?.[0])}
      />
      {file ? <p className="text-xs text-muted-foreground">{file.name}</p> : null}
    </div>
  );
}
