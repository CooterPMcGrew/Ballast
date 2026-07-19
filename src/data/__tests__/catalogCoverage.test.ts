// Coverage invariant: every muscle component must have at least one
// exercise that meaningfully targets it, or the recommender can never
// close that head's deficit ("in chest everything is mid chest" — the bug
// class this test makes impossible to reintroduce).

import { EXERCISE_CATALOG } from '@/data/exerciseCatalog';
import { MUSCLE_COMPONENTS, type MuscleComponent } from '@/domain/types';

/**
 * A component's best mover must send at least this share of its work there.
 * 0.35 ≈ "a primary target", not incidental spillover.
 */
const DEDICATED_SHARE_MIN = 0.35;

describe('catalog head coverage', () => {
  it('every muscle component has a dedicated mover', () => {
    const bestShare: Partial<Record<MuscleComponent, number>> = {};
    for (const exercise of EXERCISE_CATALOG) {
      for (const [component, share] of Object.entries(exercise.muscleContributions ?? {})) {
        const key = component as MuscleComponent;
        bestShare[key] = Math.max(bestShare[key] ?? 0, share);
      }
    }
    const uncovered = MUSCLE_COMPONENTS.filter(
      (component) => (bestShare[component] ?? 0) < DEDICATED_SHARE_MIN,
    );
    expect(uncovered).toEqual([]);
  });
});
