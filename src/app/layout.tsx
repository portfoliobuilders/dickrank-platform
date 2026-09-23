import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { Providers } from './providers';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'DickRank',
    template: '%s · DickRank',
  },
  description: 'Adults-only rankings. You must be 18 or older.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>
          <SiteHeader />
          {children}
          <noscript>
            <p className="px-4 py-6 text-center text-sm">Turn on JavaScript to sign in and verify your age.</p>
          </noscript>
        </Providers>
      </body>
    </html>
  );
}
