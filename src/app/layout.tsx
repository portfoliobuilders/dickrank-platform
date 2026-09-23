import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DickRank',
  description: 'Adult profiles and content for members who are 18 or older.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
