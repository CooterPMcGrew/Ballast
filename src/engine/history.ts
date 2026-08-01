// Workout-history aggregation — pure logic for the Home chart. Volume load
// (Σ load × reps per calendar day) is the honest metric available from
// per-lift rows: unlike the MET energy figure it needs no duration or body
// mass assumptions. Bodyweight lifts contribute 0 — known limitation until
// body mass is real (profiles); the chart shows moved external load.

const MS_PER_DAY = 86_400_000;

export interface VolumeRow {
  loadKg: number;
  repsAchieved: number;
  completedAtIso: string;
}

/**
 * Daily volume totals for the trailing window, oldest first; index
 * days-1 = today (by local calendar day).
 */
export function dailyVolumeKg(
  rows: readonly VolumeRow[],
  days: number,
  nowMs: number,
): number[] {
  const totals = new Array<number>(days).fill(0);
  const todayStartMs = startOfLocalDayMs(nowMs);
  for (const row of rows) {
    const dayIndex =
      days - 1 - Math.floor((todayStartMs - startOfLocalDayMs(Date.parse(row.completedAtIso))) / MS_PER_DAY);
    if (dayIndex < 0 || dayIndex >= days) continue;
    totals[dayIndex] = (totals[dayIndex] ?? 0) + row.loadKg * row.repsAchieved;
  }
  return totals;
}

/**
 * Insert one row into a per-exercise history that must stay oldest → newest
 * BY WALL CLOCK. The engine reads the last element as "the most recent
 * session", so a back-dated lift (past-workout log) appended blindly would
 * hijack the next prescription. Ties keep insertion order — several lifts
 * logged against the same day stay in the order they were entered.
 */
export function insertByCompletedAt<T extends { completedAtIso: string }>(
  history: readonly T[],
  row: T,
): T[] {
  const atMs = Date.parse(row.completedAtIso);
  let index = history.length;
  while (index > 0 && Date.parse(history[index - 1]!.completedAtIso) > atMs) {
    index--;
  }
  return [...history.slice(0, index), row, ...history.slice(index)];
}

function startOfLocalDayMs(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
