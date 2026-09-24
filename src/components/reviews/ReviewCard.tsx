'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { safeAvatarUrl } from '@/lib/avatar';

export interface ReviewCategory {
  name: string;
  score: number;
  icon?: ReactNode;
}

export interface Review {
  id: string;
  reviewer: {
    id: string;
    username: string;
    avatarUrl: string;
    isVerified: boolean;
    reviewCount: number;
  };
  overallRating: number;
  categories: ReviewCategory[];
  pros: string[];
  cons: string[];
  detailedReview: string;
  dateOfExperience: string;
  duration?: string;
  typeOfExperience: string;
  isAnonymous: boolean;
  helpfulCount: number;
  isHelpful?: boolean;
  createdAt: string;
  ownerResponse?: {
    text: string;
    respondedAt: string;
  };
}

export interface ReviewCardProps {
  review: Review;
  onHelpful: (reviewId: string) => void;
  onReport: (reviewId: string) => void;
  onReply?: (reviewId: string, text: string) => void;
  isOwner?: boolean;
}

function Icon({ size = 16, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ThumbsUp({ size, filled }: { size?: number; filled?: boolean }) {
  return (
    <Icon size={size}>
      <path
        d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7"
        fill={filled ? 'currentColor' : 'none'}
      />
      <path d="M7 10h3a2 2 0 0 0 2-2V5.5a2.5 2.5 0 0 0-5 0V10" fill={filled ? 'currentColor' : 'none'} />
    </Icon>
  );
}

function Flag({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" x2="4" y1="22" y2="15" />
    </Icon>
  );
}

function MessageSquare({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Icon>
  );
}

function CheckCircle2({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

function Calendar({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </Icon>
  );
}

function Clock({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </Icon>
  );
}

function Shield({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Icon>
  );
}

function getRatingColor(score: number) {
  if (score >= 9) return 'text-green-400';
  if (score >= 7) return 'text-amber-400';
  if (score >= 5) return 'text-yellow-400';
  return 'text-red-400';
}

function getRatingLabel(score: number) {
  if (score >= 9) return 'Exceptional';
  if (score >= 7) return 'Great';
  if (score >= 5) return 'Good';
  return 'Fair';
}

function barClass(score: number) {
  if (score >= 9) return 'bg-green-500';
  if (score >= 7) return 'bg-amber-500';
  if (score >= 5) return 'bg-yellow-500';
  return 'bg-red-500';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function actionClass(active?: boolean) {
  return cn(
    'inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-50',
    active && 'text-green-500',
  );
}

export function ReviewCard({ review, onHelpful, onReport, onReply, isOwner = false }: ReviewCardProps) {
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const avatarUrl = review.isAnonymous ? null : safeAvatarUrl(review.reviewer.avatarUrl);
  const longReview = review.detailedReview.length > 200;

  return (
    <article className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        {!review.isAnonymous ? (
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-sm font-medium text-zinc-300">
                {review.reviewer.username.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{review.reviewer.username}</span>
                {review.reviewer.isVerified ? (
                  <span className="text-blue-500" title="Verified reviewer">
                    <CheckCircle2 size={16} />
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-zinc-500">{review.reviewer.reviewCount} reviews</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
              <span className="text-lg text-zinc-500">?</span>
            </div>
            <div>
              <span className="font-semibold text-white">Anonymous</span>
              <p className="text-sm text-zinc-500">Verified experience</p>
            </div>
          </div>
        )}

        <div className="text-right">
          <div className={cn('text-3xl font-bold tabular-nums', getRatingColor(review.overallRating))}>
            {review.overallRating.toFixed(1)}
          </div>
          <div className="text-sm text-zinc-500">{getRatingLabel(review.overallRating)}</div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {review.categories.map((cat, idx) => (
          <div key={`${cat.name}-${idx}`} className="rounded-lg bg-zinc-950 p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-wider text-zinc-400">
                {cat.icon}
                {cat.name}
              </span>
              <span className={cn('font-bold tabular-nums', getRatingColor(cat.score))}>{cat.score}</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
              role="progressbar"
              aria-label={cat.name}
              aria-valuemin={0}
              aria-valuemax={10}
              aria-valuenow={cat.score}
            >
              <div
                className={cn('h-full rounded-full', barClass(cat.score))}
                style={{ width: `${Math.min(10, Math.max(0, cat.score)) * 10}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-sm text-zinc-400">
        <span className="flex items-center gap-1">
          <Calendar size={14} />
          {formatDate(review.dateOfExperience)}
        </span>
        {review.duration ? (
          <span className="flex items-center gap-1">
            <Clock size={14} />
            {review.duration}
          </span>
        ) : null}
        <span className="flex items-center gap-1">
          <Shield size={14} />
          {review.typeOfExperience}
        </span>
      </div>

      {review.pros.length > 0 ? (
        <div className="mb-3">
          <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold text-green-400">
            <ThumbsUp size={16} />
            Pros
          </h4>
          <ul className="space-y-1">
            {review.pros.map((pro, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="mt-1 text-green-500">+</span>
                {pro}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {review.cons.length > 0 ? (
        <div className="mb-3">
          <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold text-red-400">
            <Flag size={16} />
            Cons
          </h4>
          <ul className="space-y-1">
            {review.cons.map((con, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="mt-1 text-red-500">−</span>
                {con}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mb-4">
        <p className={cn('leading-relaxed text-zinc-300', !expanded && longReview && 'line-clamp-3')}>
          {review.detailedReview}
        </p>
        {longReview ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-sm text-amber-500 hover:underline"
            aria-expanded={expanded}
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        ) : null}
      </div>

      {review.ownerResponse ? (
        <div className="mb-4 ml-4 rounded-lg border-l-2 border-amber-500 bg-zinc-950 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="font-semibold text-white">Response from owner</span>
            <span className="text-sm text-zinc-500">{formatDate(review.ownerResponse.respondedAt)}</span>
          </div>
          <p className="text-sm text-zinc-400">{review.ownerResponse.text}</p>
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onHelpful(review.id)}
            className={actionClass(review.isHelpful)}
            aria-pressed={review.isHelpful ?? false}
          >
            <ThumbsUp size={16} filled={review.isHelpful} />
            Helpful ({review.helpfulCount})
          </button>

          {isOwner && !review.ownerResponse ? (
            <button
              type="button"
              onClick={() => setShowResponseForm((open) => !open)}
              className={actionClass()}
              aria-expanded={showResponseForm}
            >
              <MessageSquare size={16} />
              Reply
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onReport(review.id)}
          className="inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
        >
          <Flag size={16} />
          Report
        </button>
      </div>

      {showResponseForm ? (
        <div className="mt-4">
          <label htmlFor={`response-${review.id}`} className="sr-only">
            Write your response
          </label>
          <textarea
            id={`response-${review.id}`}
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Write your response..."
            maxLength={2000}
            className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            rows={3}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setShowResponseForm(false)} className={actionClass()}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const text = responseText.trim();
                if (!text) return;
                onReply?.(review.id, text);
                setShowResponseForm(false);
                setResponseText('');
              }}
              disabled={!responseText.trim()}
              className="inline-flex h-8 items-center rounded-md bg-amber-500 px-3 text-xs font-medium text-black hover:bg-amber-600 disabled:opacity-50"
            >
              Post Response
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export const mockReviews: Review[] = [
  {
    id: 'review-1',
    reviewer: {
      id: 'user-1',
      username: 'HappyClient2024',
      avatarUrl: 'https://picsum.photos/100/100?random=10',
      isVerified: true,
      reviewCount: 12,
    },
    overallRating: 9.5,
    categories: [
      { name: 'Communication', score: 10 },
      { name: 'Quality', score: 9 },
      { name: 'Value', score: 9 },
      { name: 'Experience', score: 10 },
    ],
    pros: ['Excellent communication', 'High quality content', 'Very responsive'],
    cons: ['Premium content is pricey'],
    detailedReview:
      'Absolutely amazing experience from start to finish. The content exceeded my expectations in every way. Communication was prompt and professional. Would highly recommend to anyone looking for premium adult content.',
    dateOfExperience: '2024-01-15',
    duration: '1 month subscription',
    typeOfExperience: 'VIP Subscription',
    isAnonymous: false,
    helpfulCount: 24,
    isHelpful: true,
    createdAt: '2024-01-16',
  },
  {
    id: 'review-2',
    reviewer: {
      id: 'user-2',
      username: 'Anonymous',
      avatarUrl: '',
      isVerified: false,
      reviewCount: 3,
    },
    overallRating: 8.0,
    categories: [
      { name: 'Communication', score: 8 },
      { name: 'Quality', score: 8 },
      { name: 'Value', score: 7 },
      { name: 'Experience', score: 9 },
    ],
    pros: ['Great content variety', 'Regular updates'],
    cons: ['Sometimes slow to respond'],
    detailedReview:
      'Good experience overall. Content is high quality and updated frequently. Sometimes takes a day to get a response to messages.',
    dateOfExperience: '2024-01-10',
    typeOfExperience: 'Basic Subscription',
    isAnonymous: true,
    helpfulCount: 8,
    createdAt: '2024-01-11',
    ownerResponse: {
      text: 'Thank you for the feedback! I have improved my response time and now aim to reply within 4 hours.',
      respondedAt: '2024-01-12',
    },
  },
];
