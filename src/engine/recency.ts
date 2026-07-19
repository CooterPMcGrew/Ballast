// Muscle recency — pure logic for the Home-screen body figure. Each
// completed lift contributes its activation shares scaled by a linear
// time fade (MUSCLE_RECENCY_FADE_DAYS): full brightness the moment it's
// trained, nothing after a week. Not a fatigue model — a "when did I last
// hit this" glance, and it must never pretend to be more.

import { MUSCLE_RECENCY_FADE_DAYS } from '@/config/progressionConfig';
import type { Exercise, MuscleGroup } from '@/domain/types';
import {
  contributionsForExercise,
  groupCoverage,
  type ComponentCoverage,
} from '@/engine/recommendation';

const MS_PER_DAY = 86_400_000;

export interface TimestampedLift {
  exercise: Exercise;
  completedAtIso: string;
}

/** Coverage with each lift's shares scaled by its remaining freshness. */
export function fadedCoverage(
  lifts: readonly TimestampedLift[],
  nowMs: number,
): ComponentCoverage {
  const fadeMs = MUSCLE_RECENCY_FADE_DAYS * MS_PER_DAY;
  const coverage: ComponentCoverage = {};
  for (const { exercise, completedAtIso } of lifts) {
    const ageMs = nowMs - Date.parse(completedAtIso);
    const freshness = 1 - ageMs / fadeMs;
    if (freshness <= 0) continue;
    const contributions = contributionsForExercise(exercise);
    for (const [component, share] of Object.entries(contributions)) {
      const key = component as keyof ComponentCoverage;
      coverage[key] = (coverage[key] ?? 0) + share * freshness;
    }
  }
  return coverage;
}

/** 0–1 glow per muscle group for the recency figure. */
export function muscleRecency(
  lifts: readonly TimestampedLift[],
  nowMs: number,
): Record<MuscleGroup, number> {
  return groupCoverage(fadedCoverage(lifts, nowMs));
}
