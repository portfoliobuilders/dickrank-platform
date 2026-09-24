import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MasonryGrid, type DiscoveryItem } from '@/components/discovery/MasonryGrid';

const thumb = 'https://cdn.example.com/thumb.jpg';

function item(overrides: Partial<DiscoveryItem> = {}): DiscoveryItem {
  return {
    id: 'item-1',
    title: 'Studio session',
    thumbnailUrl: thumb,
    type: 'video',
    duration: 75,
    creator: {
      id: 'user-1',
      username: 'nova',
      avatarUrl: 'https://cdn.example.com/avatar.jpg',
      isVerified: true,
      verificationTier: 'gold',
    },
    stats: { views: 1500, likes: 240, rating: 8.2 },
    aspectRatio: 1.2,
    isPremium: true,
    locked: false,
    categories: ['studio'],
    ...overrides,
  };
}

describe('masonry discovery grid', () => {
  it('hides every thumbnail until age verification is true', () => {
    const html = renderToStaticMarkup(
      <MasonryGrid items={[item()]} ageVerified={false} hasMore={false} />,
    );
    expect(html).toContain('Adults 18+ only');
    expect(html).toContain('/age-verification?next=/discovery');
    expect(html).not.toContain(thumb);
    expect(html).not.toContain('Studio session');
  });

  it('shows the hover card details for an age-verified member', () => {
    const html = renderToStaticMarkup(<MasonryGrid items={[item(), item({ id: 'item-2', title: 'Set two', type: 'image', isPremium: false })]} ageVerified />);
    expect(html).toContain('Studio session');
    expect(html).toContain('@nova');
    expect(html).toContain('PREMIUM');
    expect(html).toContain('1:15');
    expect(html).toContain('1.5K');
    expect(html).toContain('8.2');
    expect(html).toContain(thumb);
    expect(html).toContain('/content/item-1');
    expect(html).toContain('Verified');
  });

  it('keeps locked previews blurred', () => {
    const html = renderToStaticMarkup(
      <MasonryGrid items={[item({ locked: true })]} ageVerified hasMore={false} />,
    );
    expect(html).toContain('blur-md');
  });
});
