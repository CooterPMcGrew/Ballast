// Session recommender — pure logic, no React/RN imports. Given the gym, the
// session's target muscle group, and what has already been completed, rank
// available exercises by how much UNCOVERED target musculature each would
// hit: score = Σ over target components of (deficit × contribution).
//
// This is fatigue-reactivity INSIDE the session's declared intent (CLAUDE.md
// §6.3): the user picked the group; the recommender only orders coverage
// within it. Exposed Mechanism: every ranking carries a one-line rationale.

import {
  DERIVED_SHARE_BY_ROLE,
  RECOMMENDATION_CLASS_WEIGHT,
  RECOMMENDATION_COVERED_EPSILON,
  RECOMMENDATION_FRESHNESS_DECAY_PER_EXERCISE,
  RECOMMENDATION_MIN_TARGET_SHARE,
} from '@/config/progressionConfig';
import { isExerciseAvailable } from '@/domain/equipment';
import {
  COMPONENT_LABELS,
  MUSCLE_COMPONENTS_BY_GROUP,
  MUSCLE_GROUPS,
  type Exercise,
  type GymProfile,
  type MuscleComponent,
  type MuscleGroup,
} from '@/domain/types';

/** Accumulated activation per component, 0 = untouched. Sums across exercises,
 *  so a component can exceed 1 (fully covered, then some). */
export type ComponentCoverage = Partial<Record<MuscleComponent, number>>;

export interface RankedExercise {
  exercise: Exercise;
  /** Uncovered target-group work this movement would add; sort key. */
  score: number;
  /** Why it ranks here — always shown in the session list. */
  rationale: string;
}

/**
 * Explicit catalog shares when authored; otherwise derived from the role
 * lists — each role's DERIVED_SHARE_BY_ROLE weight, renormalized over the
 * roles actually present, split evenly across that role's groups' components.
 */
export function contributionsForExercise(exercise: Exercise): ComponentCoverage {
  if (exercise.muscleContributions) return exercise.muscleContributions;

  const roles: ReadonlyArray<[number, readonly MuscleGroup[]]> = [
    [DERIVED_SHARE_BY_ROLE.primary, exercise.primaryMuscles],
    [DERIVED_SHARE_BY_ROLE.secondary, exercise.secondaryMuscles],
    [DERIVED_SHARE_BY_ROLE.tertiary, exercise.tertiaryMuscles ?? []],
  ];
  const presentWeight = roles.reduce(
    (sum, [weight, groups]) => (groups.length > 0 ? sum + weight : sum),
    0,
  );
  if (presentWeight === 0) {
    // Validation guarantees non-empty primaryMuscles; refuse loudly if bypassed.
    throw new Error(`contributionsForExercise: "${exercise.id}" has no muscles listed`);
  }

  const contributions: ComponentCoverage = {};
  for (const [weight, groups] of roles) {
    if (groups.length === 0) continue;
    const components = groups.flatMap((group) => MUSCLE_COMPONENTS_BY_GROUP[group]);
    const perComponent = weight / presentWeight / components.length;
    for (const component of components) {
      contributions[component] = (contributions[component] ?? 0) + perComponent;
    }
  }
  return contributions;
}

/**
 * Collapse component coverage to one 0–1 intensity per muscle group: the
 * mean of its components, each capped at 1. This is what the body heat-map
 * and percentage readouts render — 100% means every component fully worked,
 * so a press alone can never light the whole shoulder.
 */
export function groupCoverage(coverage: ComponentCoverage): Record<MuscleGroup, number> {
  const result = {} as Record<MuscleGroup, number>;
  for (const group of MUSCLE_GROUPS) {
    const components = MUSCLE_COMPONENTS_BY_GROUP[group];
    const sum = components.reduce(
      (total, component) => total + Math.min(1, coverage[component] ?? 0),
      0,
    );
    result[group] = sum / components.length;
  }
  return result;
}

/** Sum contributions of everything completed this session. */
export function accumulateCoverage(completed: readonly Exercise[]): ComponentCoverage {
  const coverage: ComponentCoverage = {};
  for (const exercise of completed) {
    const contributions = contributionsForExercise(exercise);
    for (const [component, share] of Object.entries(contributions)) {
      const key = component as MuscleComponent;
      coverage[key] = (coverage[key] ?? 0) + share;
    }
  }
  return coverage;
}

export function rankExercisesForSession(options: {
  catalog: readonly Exercise[];
  profile: GymProfile;
  targetGroup: MuscleGroup;
  completedExercises: readonly Exercise[];
}): RankedExercise[] {
  const { catalog, profile, targetGroup, completedExercises } = options;
  const coverage = accumulateCoverage(completedExercises);
  const targetComponents = MUSCLE_COMPONENTS_BY_GROUP[targetGroup];
  const completedIds = new Set(completedExercises.map((exercise) => exercise.id));
  // 1 fresh → 0 as work accumulates (RECOMMENDATION_FRESHNESS_DECAY_PER_EXERCISE).
  const freshness = Math.max(
    0,
    1 - completedExercises.length * RECOMMENDATION_FRESHNESS_DECAY_PER_EXERCISE,
  );

  return catalog
    .filter((exercise) => !completedIds.has(exercise.id) && isExerciseAvailable(exercise, profile))
    .map((exercise) => {
      const contributions = contributionsForExercise(exercise);
      let targetShare = 0;
      let score = 0;
      let topComponent: MuscleComponent | null = null;
      let topGain = 0;
      for (const component of targetComponents) {
        const share = contributions[component] ?? 0;
        targetShare += share;
        const deficit = Math.max(0, 1 - (coverage[component] ?? 0));
        const gain = deficit * share;
        score += gain;
        if (gain > topGain) {
          topGain = gain;
          topComponent = component;
        }
      }
      // Exertion-order bias: compounds surface first while fresh; the bonus
      // decays across the session so coverage gaps win the back half.
      score *= 1 + (RECOMMENDATION_CLASS_WEIGHT[exercise.exerciseClass] - 1) * freshness;
      return { exercise, targetShare, score, topComponent };
    })
    .filter((entry) => entry.targetShare >= RECOMMENDATION_MIN_TARGET_SHARE)
    .sort(
      (a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name),
    )
    .map(({ exercise, score, topComponent }) => ({
      exercise,
      score,
      rationale: buildRationale(coverage, score, topComponent),
    }));
}

function buildRationale(
  coverage: ComponentCoverage,
  score: number,
  topComponent: MuscleComponent | null,
): string {
  if (topComponent === null || score < RECOMMENDATION_COVERED_EPSILON) {
    return 'all components covered — extra volume only';
  }
  const label = COMPONENT_LABELS[topComponent];
  const alreadyCovered = coverage[topComponent] ?? 0;
  return alreadyCovered > 0 ? `tops up ${label}` : `${label} — not yet worked today`;
}
