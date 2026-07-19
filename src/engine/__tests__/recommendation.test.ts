// Recommender behavior against the REAL catalog + profiles: the flagship
// scenario (PRD: session recommender) is "shoulders day, overhead press done
// first → the movements covering side/rear delts must outrank another press".

import { DEFAULT_GYM_PROFILES } from '@/data/defaultGymProfiles';
import { EXERCISE_CATALOG } from '@/data/exerciseCatalog';
import {
  accumulateCoverage,
  contributionsForExercise,
  rankExercisesForSession,
} from '@/engine/recommendation';
import type { Exercise, GymProfile } from '@/domain/types';

function exercise(id: string): Exercise {
  const found = EXERCISE_CATALOG.find((entry) => entry.id === id);
  if (!found) throw new Error(`test setup: no exercise "${id}" in catalog`);
  return found;
}

function profile(id: string): GymProfile {
  const found = DEFAULT_GYM_PROFILES.find((entry) => entry.id === id);
  if (!found) throw new Error(`test setup: no profile "${id}"`);
  return found;
}

const rankIds = (ranked: ReturnType<typeof rankExercisesForSession>) =>
  ranked.map((entry) => entry.exercise.id);

describe('contributionsForExercise', () => {
  it('returns explicit catalog shares untouched', () => {
    expect(contributionsForExercise(exercise('lateral-raise'))).toEqual({
      sideDelt: 0.9,
      frontDelt: 0.1,
    });
  });

  it('derives shares from role lists when not authored, summing to ≈1', () => {
    // Synthetic: the shipped catalog is fully authored, so derivation needs
    // its own fixture (it still guards user-added entries without shares).
    const unauthored: Exercise = {
      id: 'test-press',
      name: 'Test Press',
      exerciseClass: 'compound',
      equipment: ['barbell'],
      primaryMuscles: ['chest'],
      secondaryMuscles: ['triceps'],
    };
    const shares = contributionsForExercise(unauthored);
    const total = Object.values(shares).reduce((sum, share) => sum + share, 0);
    expect(total).toBeCloseTo(1, 5);
    // Primary chest splits evenly across its three components.
    expect(shares.upperChest).toBeCloseTo(shares.midChest ?? 0, 5);
  });
});

describe('rankExercisesForSession — shoulders at the commercial gym', () => {
  const options = {
    catalog: EXERCISE_CATALOG,
    profile: profile('commercial'),
    targetGroup: 'shoulders' as const,
  };

  it('fresh session: compounds lead while fresh, isolation follows', () => {
    const ids = rankIds(rankExercisesForSession({ ...options, completedExercises: [] }));
    const topClasses = ids.slice(0, 2).map((id) => exercise(id).exerciseClass);
    expect(topClasses).toEqual(['compound', 'compound']);
  });

  it('after overhead press: side/rear delt movements outrank another press', () => {
    const ranked = rankExercisesForSession({
      ...options,
      completedExercises: [exercise('overhead-press')],
    });
    const ids = rankIds(ranked);

    // The PRD's founding example, verbatim: press first, then the app steers
    // to the untouched heads — rear delt fly and cable lateral raises.
    expect(ids.slice(0, 3)).toEqual(['rear-delt-fly', 'cable-lateral-raise', 'lateral-raise']);
    expect(ids.indexOf('seated-dumbbell-shoulder-press')).toBeGreaterThan(
      ids.indexOf('lateral-raise'),
    );
    // The completed exercise never reappears.
    expect(ids).not.toContain('overhead-press');
  });

  it('explains itself in component language (Exposed Mechanism)', () => {
    const ranked = rankExercisesForSession({
      ...options,
      completedExercises: [exercise('overhead-press')],
    });
    const rearFly = ranked.find((entry) => entry.exercise.id === 'rear-delt-fly');
    expect(rearFly?.rationale).toBe('rear delt — not yet worked today');
    const lateral = ranked.find((entry) => entry.exercise.id === 'lateral-raise');
    expect(lateral?.rationale).toBe('tops up side delt');
  });

  it('drops movements with no meaningful shoulder share', () => {
    const ids = rankIds(rankExercisesForSession({ ...options, completedExercises: [] }));
    expect(ids).not.toContain('leg-extension');
    expect(ids).not.toContain('dumbbell-calf-raise');
  });
});

describe('rankExercisesForSession — equipment filtering', () => {
  it('home gym (no cable) excludes face pull from shoulders day', () => {
    const ids = rankIds(
      rankExercisesForSession({
        catalog: EXERCISE_CATALOG,
        profile: profile('home'),
        targetGroup: 'shoulders',
        completedExercises: [],
      }),
    );
    expect(ids).not.toContain('face-pull');
    expect(ids).toContain('lateral-raise');
  });
});

describe('accumulateCoverage', () => {
  it('sums shares across completed exercises', () => {
    const coverage = accumulateCoverage([exercise('lateral-raise'), exercise('face-pull')]);
    expect(coverage.sideDelt).toBeCloseTo(1.0, 5);
    expect(coverage.rearDelt).toBeCloseTo(0.6, 5);
  });
});
