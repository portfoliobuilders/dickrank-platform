import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { mockReviews, ReviewCard } from '@/components/reviews/ReviewCard';

const noop = () => undefined;

function html(review: (typeof mockReviews)[number], isOwner = false) {
  return renderToStaticMarkup(
    createElement(ReviewCard, { review, onHelpful: noop, onReport: noop, isOwner }),
  );
}

describe('review card', () => {
  it('shows the score, categories, pros, cons, and helpful count', () => {
    const markup = html(mockReviews[0]);
    expect(markup).toContain('HappyClient2024');
    expect(markup).toContain('9.5');
    expect(markup).toContain('Exceptional');
    expect(markup).toContain('Communication');
    expect(markup).toContain('Quality');
    expect(markup).toContain('Value');
    expect(markup).toContain('Experience');
    expect(markup).toContain('Excellent communication');
    expect(markup).toContain('Premium content is pricey');
    expect(markup).toContain('VIP Subscription');
    expect(markup).toContain('1 month subscription');
    expect(markup).toContain('Helpful (24)');
    expect(markup).toContain('Read more');
    expect(markup).not.toContain('>Reply<');
  });

  it('hides the member on an anonymous review and shows the owner response', () => {
    const markup = html(mockReviews[1], true);
    expect(markup).toContain('Anonymous');
    expect(markup).toContain('Verified experience');
    expect(markup).not.toContain('user-2');
    expect(markup).toContain('Response from owner');
    expect(markup).toContain('reply within 4 hours');
    expect(markup).toContain('8.0');
    expect(markup).toContain('Great');
    expect(markup).not.toContain('>Reply<');
    expect(markup).not.toContain('Read more');
  });

  it('lets the owner reply when there is no response yet', () => {
    const markup = html(mockReviews[0], true);
    expect(markup).toContain('>Reply<');
    expect(markup).not.toContain('Post Response');
  });
});
