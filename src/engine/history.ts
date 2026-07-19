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

function startOfLocalDayMs(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
