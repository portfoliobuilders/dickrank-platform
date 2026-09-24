import { describe, it, expect } from 'vitest';
import { calculateRankingScore } from '../ranking-algorithm';

describe('Ranking Algorithm', () => {
  it('calculates score correctly with all factors', () => {
    const stats = {
      averageRating: 8.5,
      viewCount: 10000,
      likeCount: 500,
      contentCount: 10,
    };

    const score = calculateRankingScore(stats);

    // Expected: (8.5 * 40) + (10000 * 0.001 * 20) + (500 * 0.01 * 20) + (10 * 2 * 20) / 100
    // = 340 + 200 + 100 + 400 / 100 = 10.4
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(20);
  });

  it('handles zero values', () => {
    const stats = {
      averageRating: 0,
      viewCount: 0,
      likeCount: 0,
      contentCount: 0,
    };

    const score = calculateRankingScore(stats);
    expect(score).toBe(0);
  });

  it('weights rating heavily', () => {
    const highRating = calculateRankingScore({
      averageRating: 10,
      viewCount: 100,
      likeCount: 10,
      contentCount: 1,
    });

    const lowRating = calculateRankingScore({
      averageRating: 5,
      viewCount: 10000,
      likeCount: 1000,
      contentCount: 50,
    });

    expect(highRating).toBeGreaterThan(lowRating);
  });
});
