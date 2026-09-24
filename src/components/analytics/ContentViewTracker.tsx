'use client';

import { useEffect } from 'react';
import { analytics } from '@/lib/analytics';

export function ContentViewTracker({
  contentId,
  contentType,
  creatorId,
}: {
  contentId: string;
  contentType: string;
  creatorId: string;
}) {
  useEffect(() => {
    analytics.trackContentView(contentId, contentType, creatorId);
  }, [contentId, contentType, creatorId]);

  return null;
}
