import { MUSCLE_RECENCY_FADE_DAYS } from '@/config/progressionConfig';
import { EXERCISE_CATALOG } from '@/data/exerciseCatalog';
import { muscleRecency } from '@/engine/recency';

const MS_PER_DAY = 86_400_000;
const NOW_MS = Date.parse('2026-07-19T12:00:00.000Z');

function liftAgedDays(exerciseId: string, ageDays: number) {
  const exercise = EXERCISE_CATALOG.find((entry) => entry.id === exerciseId);
  if (!exercise) throw new Error(`test setup: no exercise "${exerciseId}"`);
  return {
    exercise,
    completedAtIso: new Date(NOW_MS - ageDays * MS_PER_DAY).toISOString(),
  };
}

describe('muscleRecency', () => {
  // leg-extension is 100% quads (single-component group) — glow math is exact.
  it('a just-trained muscle glows at full intensity', () => {
    const glow = muscleRecency([liftAgedDays('leg-extension', 0)], NOW_MS);
    expect(glow.quads).toBeCloseTo(1, 5);
  });

  it('fades linearly — half gone at half the window', () => {
    const glow = muscleRecency(
      [liftAgedDays('leg-extension', MUSCLE_RECENCY_FADE_DAYS / 2)],
      NOW_MS,
    );
    expect(glow.quads).toBeCloseTo(0.5, 5);
  });

  it('goes fully gray past the fade window', () => {
    const glow = muscleRecency(
      [liftAgedDays('leg-extension', MUSCLE_RECENCY_FADE_DAYS + 1)],
      NOW_MS,
    );
    expect(glow.quads).toBe(0);
  });

  it('a press lights the shoulder only partially — components it skips stay dark', () => {
    const glow = muscleRecency([liftAgedDays('overhead-press', 0)], NOW_MS);
    // OHP: frontDelt 0.45 + sideDelt 0.25 + rearDelt 0 → mean ≈ 0.233.
    expect(glow.shoulders).toBeCloseTo((0.45 + 0.25) / 3, 5);
    expect(glow.quads).toBe(0);
  });
});
