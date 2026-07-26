import { buildWeekReview, epleyE1RmKg } from '@/engine/weekReview';
import type { TimestampedSessionResult } from '@/persistence/types';

const NOW_MS = Date.parse('2026-07-25T12:00:00.000Z');

function row(loadKg: number, reps: number, daysAgo: number): TimestampedSessionResult {
  return {
    loadKg,
    repsAchieved: reps,
    feedback: 'justRight',
    completedAtIso: new Date(NOW_MS - daysAgo * 86_400_000).toISOString(),
  };
}

describe('epleyE1RmKg', () => {
  it('follows Epley: load × (1 + reps/30)', () => {
    expect(epleyE1RmKg(60, 8)).toBeCloseTo(76, 5);
    expect(epleyE1RmKg(100, 1)).toBeCloseTo(103.33, 2);
  });
});

describe('buildWeekReview', () => {
  it('ranks growth between the last two sessions and flags PRs', () => {
    const review = buildWeekReview(
      {
        // 76 → 79.17 e1RM, best ever → PR
        'bench': [row(60, 8, 10), row(62.5, 8, 2)],
        // grew vs last session but an older peak stands → not a PR
        'press': [row(50, 10, 20), row(40, 8, 9), row(42.5, 8, 1)],
      },
      NOW_MS,
    );
    expect(review.movers[0]?.exerciseId).toBe('press');
    expect(review.movers[0]?.growthPct).toBeCloseTo(6.25, 2);
    expect(review.movers[0]?.isPr).toBe(false);
    expect(review.movers[1]?.exerciseId).toBe('bench');
    expect(review.movers[1]?.growthPct).toBeCloseTo(4.17, 2);
    expect(review.movers[1]?.isPr).toBe(true);
    expect(review.prCount).toBe(1);
  });

  it('excludes exercises not trained this week, single-session lifts, and bodyweight-only baselines', () => {
    const review = buildWeekReview(
      {
        'stale': [row(80, 6, 20), row(80, 7, 9)],
        'first-timer': [row(40, 8, 1)],
        'pull-up': [row(0, 8, 8), row(0, 10, 1)],
      },
      NOW_MS,
    );
    expect(review.movers).toEqual([]);
  });

  it('compares weekly volume against the previous week', () => {
    const review = buildWeekReview(
      { 'bench': [row(100, 10, 10), row(100, 11, 2)] },
      NOW_MS,
    );
    expect(review.prevWeekVolumeKg).toBe(1000);
    expect(review.weekVolumeKg).toBe(1100);
    expect(review.volumeDeltaPct).toBeCloseTo(10, 5);
  });

  it('reports null volume delta without a baseline week', () => {
    const review = buildWeekReview({ 'bench': [row(100, 10, 20), row(100, 10, 1)] }, NOW_MS);
    expect(review.volumeDeltaPct).toBeNull();
  });
});
