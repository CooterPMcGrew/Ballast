import { getExerciseById } from '@/data/exerciseCatalog';
import { buildDemoHistory } from '@/data/demoHistory';

describe('buildDemoHistory', () => {
  const rows = buildDemoHistory(Date.parse('2026-07-19T12:00:00.000Z'));

  it('references only exercises that exist in the catalog', () => {
    const unknown = rows.filter((row) => getExerciseById(row.exerciseId) === undefined);
    expect(unknown.map((row) => row.exerciseId)).toEqual([]);
  });

  it('spans multiple sessions with recent work (recency figure has something to show)', () => {
    const days = new Set(rows.map((row) => row.completedAtIso.slice(0, 10)));
    expect(days.size).toBeGreaterThanOrEqual(8);
    const newestAgeMs =
      Date.parse('2026-07-19T12:00:00.000Z') -
      Math.max(...rows.map((row) => Date.parse(row.completedAtIso)));
    expect(newestAgeMs).toBeLessThanOrEqual(2 * 86_400_000);
  });
});
