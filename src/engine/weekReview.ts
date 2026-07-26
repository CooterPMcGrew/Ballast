// Week review — pure logic for the shareable review screen. "Growth" is
// the change in estimated 1RM between an exercise's LAST TWO sessions,
// using the Epley estimate: e1RM = load × (1 + reps / 30). Epley is the
// standard rough formula; it lets +2 reps and +2.5 kg speak the same
// language. A PR means this week's e1RM is the best ever recorded for
// that exercise. Estimates, not measurements — the screen says so.

import type { TimestampedSessionResult } from '@/persistence/types';

export const E1RM_EPLEY_DIVISOR = 30;

const MS_PER_DAY = 86_400_000;
const REVIEW_WINDOW_DAYS = 7;

export function epleyE1RmKg(loadKg: number, reps: number): number {
  return loadKg * (1 + reps / E1RM_EPLEY_DIVISOR);
}

export interface WeekMover {
  exerciseId: string;
  /** e1RM change between the exercise's last two sessions, percent. */
  growthPct: number;
  latestE1RmKg: number;
  /** This week's e1RM is the best ever recorded for this exercise. */
  isPr: boolean;
}

export interface WeekReview {
  /** Sorted by growth, best first. */
  movers: WeekMover[];
  prCount: number;
  weekVolumeKg: number;
  prevWeekVolumeKg: number;
  /** null = no previous-week baseline to compare against. */
  volumeDeltaPct: number | null;
}

export function buildWeekReview(
  historyByExercise: Record<string, readonly TimestampedSessionResult[]>,
  nowMs: number,
): WeekReview {
  const weekStartMs = nowMs - REVIEW_WINDOW_DAYS * MS_PER_DAY;
  const prevWeekStartMs = nowMs - 2 * REVIEW_WINDOW_DAYS * MS_PER_DAY;

  let weekVolumeKg = 0;
  let prevWeekVolumeKg = 0;
  const movers: WeekMover[] = [];

  for (const [exerciseId, rows] of Object.entries(historyByExercise)) {
    for (const row of rows) {
      const atMs = Date.parse(row.completedAtIso);
      const volume = row.loadKg * row.repsAchieved;
      if (atMs >= weekStartMs && atMs <= nowMs) {
        weekVolumeKg += volume;
      } else if (atMs >= prevWeekStartMs && atMs < weekStartMs) {
        prevWeekVolumeKg += volume;
      }
    }

    // Growth needs two sessions, the newer one inside this week's window,
    // and a nonzero baseline (bodyweight-only rows have no e1RM to grow).
    const latest = rows[rows.length - 1];
    const previous = rows[rows.length - 2];
    if (!latest || !previous) continue;
    if (Date.parse(latest.completedAtIso) < weekStartMs) continue;
    const previousE1Rm = epleyE1RmKg(previous.loadKg, previous.repsAchieved);
    if (previousE1Rm <= 0) continue;

    const latestE1Rm = epleyE1RmKg(latest.loadKg, latest.repsAchieved);
    const bestEverE1Rm = Math.max(
      ...rows.map((row) => epleyE1RmKg(row.loadKg, row.repsAchieved)),
    );
    movers.push({
      exerciseId,
      growthPct: (latestE1Rm / previousE1Rm - 1) * 100,
      latestE1RmKg: latestE1Rm,
      isPr: latestE1Rm >= bestEverE1Rm,
    });
  }

  movers.sort((a, b) => b.growthPct - a.growthPct);

  return {
    movers,
    prCount: movers.filter((mover) => mover.isPr).length,
    weekVolumeKg,
    prevWeekVolumeKg,
    volumeDeltaPct:
      prevWeekVolumeKg > 0 ? (weekVolumeKg / prevWeekVolumeKg - 1) * 100 : null,
  };
}
