// Every progression-engine threshold lives HERE as a named, documented,
// tunable constant (CLAUDE.md §5) — nothing hardcoded inline in the engine.
// This is the difference between a system we can tune and a pile of guesses.

import type { EquipmentTag, Exercise, ExerciseClass } from '@/domain/types';

/** Load cut applied when a deload fires (PRD D4). Default 10%, arbitrary but reasonable. */
export const DELOAD_FRACTION = 0.1;

/**
 * Consecutive "Grind / Form Broke" results on the same exercise before a
 * deload fires (PRD §2). One grind halts progression; this count reduces load.
 */
export const GRIND_REPEAT_TRIGGER_COUNT = 2;

/**
 * Optional scheduled deload, in weeks. null = reactive-only. PRD D4 caveat:
 * reactive-only deloading can lag accumulated fatigue, so the scheduled path
 * stays open even though it ships disabled.
 */
export const SCHEDULED_DELOAD_INTERVAL_WEEKS: number | null = null;

/**
 * "Felt Easy" → aggressive progression: the class increment is multiplied by
 * this. "Just Right" → micro-progression at 1× (PRD §2).
 */
export const EASY_INCREMENT_MULTIPLIER = 2;

/**
 * "Felt Easy" below the rep ceiling advances this many reps at once instead
 * of the +1 a "Just Right" earns. Aggressive but stays inside the
 * double-progression window (PRD D1).
 */
export const EASY_REP_JUMP = 2;

/**
 * Double progression (PRD D1): advance reps within [repRangeLow, repRangeHigh];
 * on reaching the top, add incrementKg and drop back to the low end. Classes
 * differ by window and increment — NOT a weight-only vs reps-only split, which
 * stalls compounds past the novice phase.
 */
export interface ProgressionWindow {
  repRangeLow: number;
  repRangeHigh: number;
  incrementKg: number;
}

export const PROGRESSION_BY_CLASS: Record<ExerciseClass, ProgressionWindow> = {
  // 2.5 kg = smallest common barbell jump (1.25 kg per side).
  compound: { repRangeLow: 6, repRangeHigh: 10, incrementKg: 2.5 },
  // Smaller jump, higher window: isolation lifts tolerate load steps poorly.
  isolation: { repRangeLow: 10, repRangeHigh: 15, incrementKg: 1.25 },
};

/**
 * Effective growth rate for one exercise: the class window overlaid with any
 * per-exercise progressionOverride from the catalog. This is the ONLY place
 * the two are merged — engine and store must resolve through here.
 */
export function progressionWindowForExercise(exercise: Exercise): ProgressionWindow {
  return { ...PROGRESSION_BY_CLASS[exercise.exerciseClass], ...exercise.progressionOverride };
}

// ── Session recommender tunables ──────────────────────────────────────

/**
 * Derived activation shares by role when an exercise has no explicit
 * muscleContributions: each role's weight splits evenly across that role's
 * groups' components, renormalized over the roles present. Rough by design
 * (CLAUDE.md §6.2 — seeds, not truth); explicit catalog data sharpens it.
 */
export const DERIVED_SHARE_BY_ROLE = {
  primary: 0.65,
  secondary: 0.25,
  tertiary: 0.1,
} as const;

/**
 * An exercise sending less than this share of its work to the session's
 * target group is irrelevant to the session and is not listed.
 */
export const RECOMMENDATION_MIN_TARGET_SHARE = 0.1;

/**
 * Below this score (uncovered target-group work the movement would add),
 * the group counts as fully covered and the rationale says so instead of
 * naming a component.
 */
export const RECOMMENDATION_COVERED_EPSILON = 0.05;

/**
 * Exertion-order bias: compounds should surface first while the user is
 * fresh (standard programming), so their coverage score is scaled up. Kept
 * mild on purpose — a redundant second press must still fall below the
 * isolations that fill an untouched component (the whole point of the
 * recommender). 1.5 is the tuned balance point for both properties.
 */
export const RECOMMENDATION_CLASS_WEIGHT: Record<ExerciseClass, number> = {
  compound: 1.5,
  isolation: 1,
};

/** Default rest prescription per class; user-adjustable per exercise later. */
export const REST_DEFAULT_SEC_BY_CLASS: Record<ExerciseClass, number> = {
  compound: 180,
  isolation: 90,
};

/** Working sets per exercise until per-program set schemes exist. */
export const SETS_PER_EXERCISE_DEFAULT = 3;

/**
 * First-session seed loads by equipment (PRD D2): rough starting estimates,
 * NOT a conversion table presented as truth. The user corrects via steppers
 * before the first set and the Post-Set loop corrects from there. Barbell =
 * empty 20 kg bar; dumbbell is per-hand.
 */
export const SEED_LOAD_KG_BY_EQUIPMENT: Record<EquipmentTag, number> = {
  barbell: 20,
  dumbbell: 8,
  kettlebell: 12,
  machine: 20,
  cable: 15,
  bands: 0,
  bodyweight: 0,
  bench: 0,
  rack: 0,
  pullupBar: 0,
};

/**
 * Which equipment tag decides the seed when an exercise carries several
 * (e.g. barbell + bench): first match wins, ordered by how strongly the tag
 * determines the working implement.
 */
export const SEED_EQUIPMENT_PRIORITY: readonly EquipmentTag[] = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'machine',
  'cable',
  'bands',
  'bodyweight',
];
