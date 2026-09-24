import { DiscoveryPage } from '@/components/discovery/MasonryGrid';

export const dynamic = 'force-dynamic';

export default function DiscoveryRoute() {
  return (
    <main>
      <h1 className="mb-2 text-2xl font-semibold">Discover</h1>
      <p className="mb-6 text-sm text-zinc-400">Photos and videos from creators. Adults 18 and older.</p>
      <DiscoveryPage />
    </main>
  );
}
