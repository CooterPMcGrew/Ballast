// Every progression-engine threshold lives HERE as a named, documented,
// tunable constant (CLAUDE.md §5) — nothing hardcoded inline in the engine.
// This is the difference between a system we can tune and a pile of guesses.

import type { ExerciseClass } from '@/domain/types';

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

/** Default rest prescription per class; user-adjustable per exercise later. */
export const REST_DEFAULT_SEC_BY_CLASS: Record<ExerciseClass, number> = {
  compound: 180,
  isolation: 90,
};
