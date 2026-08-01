import { dailyVolumeKg, insertByCompletedAt } from '@/engine/history';

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

describe('insertByCompletedAt', () => {
  const day = (daysAgo: number, tag: string) => ({
    tag,
    completedAtIso: new Date(NOW_MS - daysAgo * 86_400_000).toISOString(),
  });

  it('a back-dated lift lands before the newer ones, never at the tail', () => {
    // The tail is what prescribeNextSession reads as "last session" — a
    // 10-day-old lift appended blindly would drive the next prescription.
    const history = [day(5, 'older'), day(1, 'newest')];
    const merged = insertByCompletedAt(history, day(10, 'backdated'));
    expect(merged.map((entry) => entry.tag)).toEqual(['backdated', 'older', 'newest']);
  });

  it('a newer lift still appends', () => {
    const merged = insertByCompletedAt([day(5, 'older')], day(0, 'today'));
    expect(merged.map((entry) => entry.tag)).toEqual(['older', 'today']);
  });

  it('same-instant rows keep insertion order', () => {
    const first = day(3, 'first');
    const merged = insertByCompletedAt([day(9, 'old'), first], day(3, 'second'));
    expect(merged.map((entry) => entry.tag)).toEqual(['old', 'first', 'second']);
  });

  it('empty history takes the row', () => {
    expect(insertByCompletedAt([], day(2, 'only'))).toHaveLength(1);
  });
});
