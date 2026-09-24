import type { Metadata } from 'next';
import { AnalyticsPageView } from '@/components/analytics/AnalyticsPageView';
import './globals.css';

export const metadata: Metadata = {
  title: 'DickRank',
  description: 'Creator subscriptions, tips, and payouts for adults 18+.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AnalyticsPageView />
        {children}
      </body>
    </html>
  );
}
