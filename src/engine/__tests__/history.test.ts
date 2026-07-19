import { dailyVolumeKg } from '@/engine/history';

const NOW_MS = Date.parse('2026-07-19T12:00:00');

function row(loadKg: number, reps: number, daysAgo: number) {
  return {
    loadKg,
    repsAchieved: reps,
    completedAtIso: new Date(NOW_MS - daysAgo * 86_400_000).toISOString(),
  };
}

describe('dailyVolumeKg', () => {
  it('sums load × reps per day, today in the last slot', () => {
    const totals = dailyVolumeKg([row(100, 5, 0), row(60, 10, 0), row(80, 8, 2)], 14, NOW_MS);
    expect(totals[13]).toBe(100 * 5 + 60 * 10);
    expect(totals[11]).toBe(80 * 8);
    expect(totals.filter((t) => t > 0)).toHaveLength(2);
  });

  it('drops rows outside the window', () => {
    const totals = dailyVolumeKg([row(100, 5, 20)], 14, NOW_MS);
    expect(totals.every((t) => t === 0)).toBe(true);
  });

  it('bodyweight rows contribute zero (known limitation, documented)', () => {
    const totals = dailyVolumeKg([row(0, 12, 0)], 14, NOW_MS);
    expect(totals[13]).toBe(0);
  });
});
