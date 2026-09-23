"use client";

import { createClient } from "@supabase/supabase-js";
import { useState } from "react";

import { createRatingSchema } from "@/lib/validation";

type ScoreField = "overall" | "feel" | "performance" | "experience" | "userExperience";

const CATEGORIES: Array<{ field: ScoreField; label: string }> = [
  { field: "overall", label: "Overall" },
  { field: "feel", label: "Feel" },
  { field: "performance", label: "Performance" },
  { field: "experience", label: "Experience" },
  { field: "userExperience", label: "User experience" },
];

export type RatingComponentProps = {
  contentId: string;
  /** Supabase access token. When omitted, the signed-in browser session is used. */
  accessToken?: string;
  onSubmitted?: (result: { id: string; weightedScore: number }) => void;
};

async function resolveAccessToken(accessToken?: string): Promise<string | null> {
  if (accessToken) return accessToken;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const supabase = createClient(url, anonKey);
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

type FieldErrors = Partial<Record<string, string[] | undefined>>;

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2.6l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 16.8 6.6 19.4l1-6.1L3.2 9l6.1-.9L12 2.6z"
      />
    </svg>
  );
}

function StarScoreInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  error?: string;
}) {
  const inputId = `score-${label.toLowerCase().replace(/\s+/g, "-")}`;

  function valueFromStar(index: number, clientX: number, rect: DOMRect) {
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const step = Math.min(4, Math.max(1, Math.ceil(ratio * 4)));
    return Math.max(1, index * 2 + step * 0.5);
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <label htmlFor={inputId} className="mb-2 flex items-center justify-between gap-3 text-sm font-medium">
        <span>{label}</span>
        <span className="tabular-nums text-zinc-300">{value == null ? "Not set" : `${value.toFixed(1)} / 10`}</span>
      </label>
      <div className="mb-2 flex gap-1">
        {[0, 1, 2, 3, 4].map((index) => {
          const fill = value == null ? 0 : Math.min(1, Math.max(0, (value - index * 2) / 2));
          return (
            <button
              key={index}
              type="button"
              className="relative h-7 w-7 text-zinc-700"
              aria-label={`Set ${label} around ${index * 2 + 1} to ${index * 2 + 2}`}
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                onChange(valueFromStar(index, event.clientX, rect));
              }}
            >
              <StarIcon />
              <span className="absolute inset-y-0 left-0 overflow-hidden text-amber-400" style={{ width: `${fill * 100}%` }}>
                <StarIcon />
              </span>
            </button>
          );
        })}
      </div>
      <input
        id={inputId}
        type="range"
        min={1}
        max={10}
        step={0.5}
        value={value ?? 1}
        aria-invalid={error ? true : undefined}
        aria-valuetext={value == null ? "Not set" : `${value} out of 10`}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-amber-400"
      />
      {error ? <p className="mt-1 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}

export function RatingComponent({ contentId, accessToken, onSubmitted }: RatingComponentProps) {
  const [scores, setScores] = useState<Record<ScoreField, number | null>>({
    overall: null,
    feel: null,
    performance: null,
    experience: null,
    userExperience: null,
  });
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");
  const [review, setReview] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ weightedScore: number } | null>(null);

  function setScore(field: ScoreField, value: number) {
    setScores((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const missing = CATEGORIES.filter((category) => scores[category.field] == null);
    if (missing.length > 0) {
      const errors: FieldErrors = {};
      for (const category of missing) errors[category.field] = [`Choose a ${category.label} score.`];
      setFieldErrors(errors);
      setFormError("Add every score before you submit.");
      return;
    }

    const parsed = createRatingSchema.safeParse({
      contentId,
      overall: scores.overall,
      feel: scores.feel,
      performance: scores.performance,
      experience: scores.experience,
      userExperience: scores.userExperience,
      pros,
      cons,
      review,
      anonymous,
    });
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      setFormError("Check the review and try again.");
      return;
    }

    let token: string | null = null;
    try {
      token = await resolveAccessToken(accessToken);
    } catch {
      token = null;
    }
    if (!token) {
      setFormError("Sign in with a verified 18+ account to rate.");
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json()) as {
        error?: string;
        fieldErrors?: FieldErrors;
        rating?: { id: string; weightedScore: number };
      };
      if (!response.ok || !payload.rating) {
        setFieldErrors(payload.fieldErrors ?? {});
        setFormError(payload.error ?? "The review could not be saved.");
        return;
      }
      setDone({ weightedScore: payload.rating.weightedScore });
      onSubmitted?.({ id: payload.rating.id, weightedScore: payload.rating.weightedScore });
    } catch {
      setFormError("The review could not be saved. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-800 bg-emerald-950/40 p-6" role="status">
        <h2 className="text-xl font-semibold">Review saved</h2>
        <p className="mt-2 text-zinc-300">
          Weighted score: <span className="font-semibold text-white">{done.weightedScore.toFixed(1)}</span> out of 10.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-6" noValidate>
      <div>
        <h2 className="text-xl font-semibold">Rate this</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Scores run from 1 to 10 in half-point steps. Only verified 18+ members can submit, and you can&apos;t rate your own content.
        </p>
      </div>

      {formError ? (
        <p className="rounded-lg border border-rose-900 bg-rose-950/50 px-3 py-2 text-sm text-rose-200" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {CATEGORIES.map((category) => (
          <StarScoreInput
            key={category.field}
            label={category.label}
            value={scores[category.field]}
            onChange={(value) => setScore(category.field, value)}
            error={fieldErrors[category.field]?.[0]}
          />
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-medium">
          Pros
          <input
            value={pros}
            onChange={(event) => setPros(event.target.value)}
            maxLength={500}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-normal"
          />
          {fieldErrors.pros?.[0] ? <span className="mt-1 block text-rose-300">{fieldErrors.pros[0]}</span> : null}
        </label>
        <label className="block text-sm font-medium">
          Cons
          <input
            value={cons}
            onChange={(event) => setCons(event.target.value)}
            maxLength={500}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-normal"
          />
          {fieldErrors.cons?.[0] ? <span className="mt-1 block text-rose-300">{fieldErrors.cons[0]}</span> : null}
        </label>
      </div>

      <label className="block text-sm font-medium">
        Detailed review
        <textarea
          value={review}
          onChange={(event) => setReview(event.target.value)}
          minLength={20}
          maxLength={5000}
          rows={5}
          required
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-normal"
        />
        <span className="mt-1 block font-normal text-zinc-500">{review.trim().length} / 5000</span>
        {fieldErrors.review?.[0] ? <span className="mt-1 block text-rose-300">{fieldErrors.review[0]}</span> : null}
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(event) => setAnonymous(event.target.checked)}
          className="h-4 w-4 accent-amber-400"
        />
        Post anonymously
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-amber-400 px-5 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit rating"}
      </button>
    </form>
  );
}
