'use client';

import mixpanel from 'mixpanel-browser';

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

if (typeof window !== 'undefined' && MIXPANEL_TOKEN) {
  mixpanel.init(MIXPANEL_TOKEN, {
    debug: process.env.NODE_ENV === 'development',
    track_pageview: true,
    persistence: 'localStorage',
    secure_cookie: true,
  });
}

type AnalyticsProperties = Record<string, any>;

export const analytics = {
  identify: (userId: string, traits?: AnalyticsProperties) => {
    if (!MIXPANEL_TOKEN || typeof window === 'undefined') return;
    mixpanel.identify(userId);
    if (traits) mixpanel.people.set(traits);
  },

  track: (event: string, properties?: AnalyticsProperties) => {
    if (!MIXPANEL_TOKEN) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Analytics]', event, properties);
      }
      return;
    }
    if (typeof window === 'undefined') return;
    mixpanel.track(event, {
      ...properties,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    });
  },

  trackPageView: (pageName: string) => {
    analytics.track('Page Viewed', { page: pageName });
  },

  trackContentView: (contentId: string, contentType: string, creatorId: string) => {
    analytics.track('Content Viewed', {
      content_id: contentId,
      content_type: contentType,
      creator_id: creatorId,
    });
  },

  trackRating: (contentId: string, rating: number, hasDetailedReview: boolean) => {
    analytics.track('Rating Submitted', {
      content_id: contentId,
      rating,
      has_detailed_review: hasDetailedReview,
    });
  },

  trackSubscription: (creatorId: string, tier: string, price: number) => {
    analytics.track('Subscription Started', {
      creator_id: creatorId,
      tier,
      price,
      revenue: price,
    });
  },

  trackSearch: (query: string, resultsCount: number, filtersUsed: string[]) => {
    analytics.track('Search Performed', {
      query,
      results_count: resultsCount,
      filters_used: filtersUsed,
    });
  },

  trackError: (error: Error, context?: string) => {
    analytics.track('Error Occurred', {
      error_message: error.message,
      error_stack: error.stack,
      context,
    });
  },

  timeEvent: (eventName: string) => {
    if (!MIXPANEL_TOKEN || typeof window === 'undefined') return;
    mixpanel.time_event(eventName);
  },

  reset: () => {
    if (!MIXPANEL_TOKEN || typeof window === 'undefined') return;
    mixpanel.reset();
  },
};

export function useAnalytics() {
  return analytics;
}
