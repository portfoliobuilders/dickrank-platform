"use client";

import { useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadProgress } from "@/components/upload/UploadProgress";
import { CONTENT_CATEGORIES, type ContentCategoryValue, type ContentPrivacyValue } from "@/lib/categories";
import {
  ALLOWED_CONTENT_TYPES,
  IMAGE_MAX_BYTES,
  VIDEO_MAX_BYTES,
  isVideoType,
  validateUploadFile,
} from "@/lib/uploadLimits";

type UploadPhase = "idle" | "uploading" | "processing" | "success" | "error";

type ContentUploaderProps = {
  accessToken: string;
  onUploaded?: (contentId: string) => void;
};

type PresignResponse = {
  uploadUrl: string;
  finalUrl: string;
  key: string;
  requiredHeaders: Record<string, string>;
};

const accept = ALLOWED_CONTENT_TYPES.reduce<Record<string, string[]>>((map, type) => {
  map[type] = [];
  return map;
}, {});

async function captureVideoThumbnail(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.src = url;
    video.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Could not read the video."));
    });
    const target = Number.isFinite(video.duration) ? Math.min(1, video.duration / 2) : 0;
    if (target > 0) {
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        video.currentTime = target;
      });
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 180;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function putFile(
  uploadUrl: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (value: number) => void,
  register: (xhr: XMLHttpRequest) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    register(xhr);
    xhr.open("PUT", uploadUrl);
    Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("Upload failed."));
    };
    xhr.onerror = () => reject(new Error("Upload failed."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(file);
  });
}

export function ContentUploader({ accessToken, onUploaded }: ContentUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ContentCategoryValue | "">("");
  const [privacy, setPrivacy] = useState<ContentPrivacyValue>("PUBLIC");
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const previewRef = useRef<string | null>(null);

  const helper = useMemo(
    () => "Images up to 50MB. Videos up to 500MB. JPEG, PNG, WebP, GIF, MP4, WebM, or QuickTime.",
    [],
  );

  function clearPreview() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
  }

  async function selectFile(next: File) {
    const problem = validateUploadFile(next.type, next.size);
    if (problem) {
      setErrorMessage(problem);
      setPhase("error");
      return;
    }
    clearPreview();
    setFile(next);
    setErrorMessage("");
    setPhase("idle");
    setProgress(0);
    if (next.type.startsWith("image/")) {
      const url = URL.createObjectURL(next);
      previewRef.current = url;
      setPreviewUrl(url);
      return;
    }
    const thumbnail = await captureVideoThumbnail(next);
    setPreviewUrl(thumbnail);
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    accept,
    maxSize: VIDEO_MAX_BYTES,
    onDrop: (accepted, rejected) => {
      const rejection = rejected[0]?.errors[0];
      if (rejection) {
        const tooBig = rejection.code === "file-too-large";
        setErrorMessage(
          tooBig
            ? "That file is too large. Images must be 50MB or smaller and videos 500MB or smaller."
            : "Only image and video files are allowed.",
        );
        setPhase("error");
        return;
      }
      const next = accepted[0];
      if (next) void selectFile(next);
    },
  });

  function cancelUpload() {
    xhrRef.current?.abort();
  }

  async function startUpload() {
    if (!file) {
      setErrorMessage("Choose an image or video first.");
      setPhase("error");
      return;
    }
    if (!title.trim() || !category) {
      setErrorMessage("Add a title and choose a category.");
      setPhase("error");
      return;
    }
    if (isVideoType(file.type) ? file.size > VIDEO_MAX_BYTES : file.size > IMAGE_MAX_BYTES) {
      setErrorMessage(isVideoType(file.type) ? "Videos must be 500MB or smaller." : "Images must be 50MB or smaller.");
      setPhase("error");
      return;
    }
    if (!accessToken) {
      setErrorMessage("Sign in before uploading.");
      setPhase("error");
      return;
    }

    setPhase("uploading");
    setProgress(0);
    setErrorMessage("");

    try {
      const presignResponse = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });
      const presign = (await presignResponse.json()) as PresignResponse & { error?: string };
      if (!presignResponse.ok) {
        throw new Error(presign.error || "Could not start the upload.");
      }

      await putFile(presign.uploadUrl, file, presign.requiredHeaders, setProgress, (xhr) => {
        xhrRef.current = xhr;
      });

      setPhase("processing");
      const completeResponse = await fetch("/api/upload/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          key: presign.key,
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          privacy,
          contentType: file.type,
          fileSize: file.size,
        }),
      });
      const completed = (await completeResponse.json()) as { contentId?: string; error?: string };
      if (!completeResponse.ok || !completed.contentId) {
        throw new Error(completed.error || "Processing failed.");
      }

      setProgress(100);
      setPhase("success");
      onUploaded?.(completed.contentId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      if (message === "Upload cancelled.") {
        setPhase("idle");
        setProgress(0);
        setErrorMessage("");
        return;
      }
      setErrorMessage(message);
      setPhase("error");
    } finally {
      xhrRef.current = null;
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void startUpload();
      }}
    >
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-10 text-center ${
          isDragActive ? "border-zinc-900 bg-zinc-100" : "border-zinc-300 bg-white"
        }`}
      >
        <input {...getInputProps()} aria-label="Choose an image or video" />
        <p className="text-base font-medium text-zinc-900">Drag and drop a file, or click to browse</p>
        <p className="mt-2 text-sm text-zinc-500">{helper}</p>
        {file ? <p className="mt-3 text-sm text-zinc-800">{file.name}</p> : null}
      </div>

      {previewUrl ? (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-black">
          {/* Thumbnail is a local preview of the creator's own file, not remote HTML. */}
          <img src={previewUrl} alt="Upload preview" className="mx-auto max-h-72 object-contain" />
        </div>
      ) : null}

      <label className="block text-sm font-medium text-zinc-800">
        Title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          required
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base"
        />
      </label>

      <label className="block text-sm font-medium text-zinc-800">
        Description
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={2000}
          rows={4}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base"
        />
      </label>

      <label className="block text-sm font-medium text-zinc-800">
        Category
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as ContentCategoryValue)}
          required
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base"
        >
          <option value="">Choose a category</option>
          {CONTENT_CATEGORIES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="text-sm font-medium text-zinc-800">Privacy</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {(
            [
              ["PUBLIC", "Public"],
              ["PRIVATE", "Private"],
              ["PREMIUM", "Premium"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`rounded-lg border px-3 py-2 text-sm ${
                privacy === value ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-800"
              }`}
            >
              <input
                type="radio"
                name="privacy"
                value={value}
                checked={privacy === value}
                onChange={() => setPrivacy(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <UploadProgress
        phase={phase}
        progress={progress}
        errorMessage={errorMessage}
        onCancel={cancelUpload}
        onRetry={() => {
          void startUpload();
        }}
      />

      <button
        type="submit"
        disabled={phase === "uploading" || phase === "processing"}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {phase === "uploading" ? "Uploading..." : phase === "processing" ? "Processing..." : "Upload"}
      </button>
    </form>
  );
}
