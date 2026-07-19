// Progression engine — pure logic, no React/RN imports. Implements double
// progression (PRD D1) driven solely by the 3-state Post-Set Matrix (PRD D5).
// Every tunable lives in progressionConfig; nothing is hardcoded here.
//
// Exposed Mechanism (CLAUDE.md §3): every plan carries a human-readable
// `rationale`. If a branch can't explain itself in one line, it's wrong.

import {
  DELOAD_FRACTION,
  EASY_INCREMENT_MULTIPLIER,
  EASY_REP_JUMP,
  GRIND_REPEAT_TRIGGER_COUNT,
  type ProgressionWindow,
} from '@/config/progressionConfig';
import type { SetFeedback } from '@/domain/types';

/** One past session's outcome for a single exercise, aggregated across sets. */
export interface ExerciseSessionResult {
  loadKg: number;
  /** Reps achieved on the final working set — the honest capacity signal. */
  repsAchieved: number;
  /** Session-level feedback; use worstFeedback() to collapse per-set taps. */
  feedback: SetFeedback;
}

/** Engine output; caller attaches exerciseId to make a full SetPrescription. */
export interface NextSetPlan {
  loadKg: number;
  targetReps: number;
  rationale: string;
}

/**
 * Collapse per-set taps into a session verdict: the WORST set governs,
 * because progression must respect the set that exposed the limit, not the
 * warm one that flattered it.
 */
export function worstFeedback(feedbacks: readonly SetFeedback[]): SetFeedback {
  if (feedbacks.length === 0) {
    throw new Error('worstFeedback: no set feedback recorded');
  }
  if (feedbacks.includes('grind')) return 'grind';
  if (feedbacks.includes('justRight')) return 'justRight';
  return 'easy';
}

/** First tracked session: user (or a substitution seed, PRD D2) supplies the load. */
export function seedPlan(window: ProgressionWindow, seedLoadKg: number): NextSetPlan {
  const { repRangeLow } = window;
  return {
    loadKg: seedLoadKg,
    targetReps: repRangeLow,
    rationale: 'baseline — first tracked session, correct via feedback',
  };
}

/**
 * Prescribe the next session from history (most recent last).
 *
 * Branches:
 * - easy      → below ceiling: +EASY_REP_JUMP reps; at ceiling: increment ×
 *               EASY_INCREMENT_MULTIPLIER, reps back to floor.
 * - justRight → below ceiling: +1 rep; at ceiling: +increment, reps to floor.
 * - grind     → repeat as-is; every GRIND_REPEAT_TRIGGER_COUNT consecutive
 *               grinds cut load by DELOAD_FRACTION (rounded DOWN to a
 *               loadable step — a deload must never round back up).
 *
 * Throws on empty history: seeding is an explicit, separate act (seedPlan).
 */
export function prescribeNextSession(
  window: ProgressionWindow,
  history: readonly ExerciseSessionResult[],
): NextSetPlan {
  const last = history[history.length - 1];
  if (last === undefined) {
    throw new Error('prescribeNextSession: empty history — use seedPlan() first');
  }

  const { repRangeLow, repRangeHigh, incrementKg } = window;

  if (last.feedback === 'grind') {
    const streak = trailingGrindCount(history);
    // Cut every Nth consecutive grind (N, 2N, ...): still grinding after a
    // deload means the cut wasn't enough — cut again, don't wait out a new N.
    if (streak % GRIND_REPEAT_TRIGGER_COUNT === 0) {
      if (last.loadKg === 0) {
        // Bodyweight with no external load: nothing to cut — drop the rep
        // target to the floor instead.
        return {
          loadKg: 0,
          targetReps: repRangeLow,
          rationale: `back to ${repRangeLow} reps — ${streak} grinds at bodyweight`,
        };
      }
      const cutKg = roundDownToStep(last.loadKg * (1 - DELOAD_FRACTION), incrementKg);
      return {
        loadKg: cutKg,
        targetReps: repRangeLow,
        rationale: `−${Math.round(DELOAD_FRACTION * 100)}% deload — ${streak} grinds in a row`,
      };
    }
    return {
      loadKg: last.loadKg,
      targetReps: last.repsAchieved,
      rationale: 'repeat — last session was a grind',
    };
  }

  const atCeiling = last.repsAchieved >= repRangeHigh;

  if (atCeiling) {
    const multiplier = last.feedback === 'easy' ? EASY_INCREMENT_MULTIPLIER : 1;
    const addKg = incrementKg * multiplier;
    return {
      loadKg: last.loadKg + addKg,
      targetReps: repRangeLow,
      rationale:
        last.feedback === 'easy'
          ? `+${formatKg(addKg)} kg — topped the range and it felt easy`
          : `+${formatKg(addKg)} kg — topped the rep range`,
    };
  }

  const repJump = last.feedback === 'easy' ? EASY_REP_JUMP : 1;
  const targetReps = Math.min(last.repsAchieved + repJump, repRangeHigh);
  return {
    loadKg: last.loadKg,
    targetReps,
    rationale:
      last.feedback === 'easy'
        ? `+${targetReps - last.repsAchieved} reps — last session felt easy`
        : '+1 rep — last session felt right',
  };
}

/** Consecutive grind sessions at the end of history. */
function trailingGrindCount(history: readonly ExerciseSessionResult[]): number {
  let count = 0;
  for (let i = history.length - 1; i >= 0 && history[i]?.feedback === 'grind'; i--) {
    count++;
  }
  return count;
}

/**
 * Round down to a loadable step. Floating-point note: divide-floor-multiply
 * on 0.05-grade steps is exact enough for gym loads; result re-rounded to
 * 2 decimals to kill artifacts like 56.24999….
 */
function roundDownToStep(loadKg: number, stepKg: number): number {
  const stepped = Math.floor(loadKg / stepKg) * stepKg;
  return Math.max(0, Math.round(stepped * 100) / 100);
}

/** "2.5" not "2.50", "5" not "5.00" — rationale strings stay terse. */
function formatKg(kg: number): string {
  return String(Math.round(kg * 100) / 100);
}
