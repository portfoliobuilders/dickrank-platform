"use client";

import { useState } from "react";
import { ContentUploader } from "@/components/upload/ContentUploader";

export default function UploadPage() {
  const [accessToken, setAccessToken] = useState("");
  const [contentId, setContentId] = useState("");

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">Upload content</h1>
      <p className="mt-2 text-sm text-zinc-600">
        You must be signed in and age verified. New uploads stay private until moderation finishes.
      </p>
      <label className="mt-6 block text-sm font-medium text-zinc-800">
        Access token
        <input
          type="password"
          value={accessToken}
          onChange={(event) => setAccessToken(event.target.value)}
          autoComplete="off"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
        />
      </label>
      <div className="mt-6">
        <ContentUploader
          accessToken={accessToken}
          onUploaded={(id) => setContentId(id)}
        />
      </div>
      {contentId ? (
        <p className="mt-4 text-sm text-emerald-700">Saved for review. Reference {contentId}.</p>
      ) : null}
    </main>
  );
}
