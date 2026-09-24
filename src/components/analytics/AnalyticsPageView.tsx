'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { analytics } from '@/lib/analytics';

export function AnalyticsPageView() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    analytics.trackPageView(pathname);
  }, [pathname]);

  return null;
}
