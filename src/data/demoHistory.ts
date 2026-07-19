// Demo history — an explicit, deterministic ~3-week training block for
// prototyping the recency figure and volume chart (seeded ONLY via the
// Settings button; never automatically). A push/pull/legs rotation with
// plausible loads and gentle progression, so screens look like a real
// user's, not like noise.

import type { PersistedSessionRow } from '@/persistence/types';
import type { SetFeedback } from '@/domain/types';

interface DemoLift {
  exerciseId: string;
  loadKg: number;
  repsAchieved: number;
  feedback: SetFeedback;
  daysAgo: number;
}

/** exerciseIds MUST exist in exercises.json — a test enforces it. */
const DEMO_LIFTS: DemoLift[] = [
  // Push A — 20 days ago
  { exerciseId: 'barbell-bench-press', loadKg: 60, repsAchieved: 8, feedback: 'justRight', daysAgo: 20 },
  { exerciseId: 'overhead-press', loadKg: 40, repsAchieved: 6, feedback: 'justRight', daysAgo: 20 },
  { exerciseId: 'triceps-pushdown', loadKg: 25, repsAchieved: 12, feedback: 'easy', daysAgo: 20 },
  // Pull A — 18 days ago
  { exerciseId: 'barbell-row', loadKg: 55, repsAchieved: 8, feedback: 'justRight', daysAgo: 18 },
  { exerciseId: 'lat-pulldown', loadKg: 50, repsAchieved: 10, feedback: 'easy', daysAgo: 18 },
  { exerciseId: 'dumbbell-curl', loadKg: 12, repsAchieved: 10, feedback: 'justRight', daysAgo: 18 },
  // Legs A — 16 days ago
  { exerciseId: 'barbell-back-squat', loadKg: 80, repsAchieved: 6, feedback: 'grind', daysAgo: 16 },
  { exerciseId: 'leg-curl', loadKg: 35, repsAchieved: 12, feedback: 'justRight', daysAgo: 16 },
  { exerciseId: 'machine-calf-raise', loadKg: 60, repsAchieved: 15, feedback: 'easy', daysAgo: 16 },
  // Push B — 13 days ago
  { exerciseId: 'barbell-bench-press', loadKg: 60, repsAchieved: 9, feedback: 'justRight', daysAgo: 13 },
  { exerciseId: 'seated-dumbbell-shoulder-press', loadKg: 18, repsAchieved: 8, feedback: 'justRight', daysAgo: 13 },
  { exerciseId: 'lateral-raise', loadKg: 8, repsAchieved: 12, feedback: 'easy', daysAgo: 13 },
  // Pull B — 11 days ago
  { exerciseId: 'deadlift', loadKg: 100, repsAchieved: 5, feedback: 'justRight', daysAgo: 11 },
  { exerciseId: 'seated-cable-row', loadKg: 55, repsAchieved: 10, feedback: 'justRight', daysAgo: 11 },
  { exerciseId: 'face-pull', loadKg: 20, repsAchieved: 15, feedback: 'easy', daysAgo: 11 },
  // Legs B — 9 days ago
  { exerciseId: 'barbell-back-squat', loadKg: 80, repsAchieved: 7, feedback: 'justRight', daysAgo: 9 },
  { exerciseId: 'leg-press', loadKg: 120, repsAchieved: 10, feedback: 'easy', daysAgo: 9 },
  { exerciseId: 'leg-extension', loadKg: 40, repsAchieved: 12, feedback: 'justRight', daysAgo: 9 },
  // Push C — 6 days ago
  { exerciseId: 'barbell-bench-press', loadKg: 62.5, repsAchieved: 6, feedback: 'justRight', daysAgo: 6 },
  { exerciseId: 'overhead-press', loadKg: 40, repsAchieved: 8, feedback: 'easy', daysAgo: 6 },
  { exerciseId: 'dips', loadKg: 0, repsAchieved: 10, feedback: 'justRight', daysAgo: 6 },
  // Pull C — 4 days ago
  { exerciseId: 'pull-up', loadKg: 0, repsAchieved: 8, feedback: 'justRight', daysAgo: 4 },
  { exerciseId: 'barbell-row', loadKg: 57.5, repsAchieved: 8, feedback: 'justRight', daysAgo: 4 },
  { exerciseId: 'rear-delt-fly', loadKg: 8, repsAchieved: 14, feedback: 'easy', daysAgo: 4 },
  // Legs C — 2 days ago
  { exerciseId: 'romanian-deadlift', loadKg: 70, repsAchieved: 8, feedback: 'justRight', daysAgo: 2 },
  { exerciseId: 'bulgarian-split-squat', loadKg: 16, repsAchieved: 10, feedback: 'grind', daysAgo: 2 },
  { exerciseId: 'dumbbell-calf-raise', loadKg: 20, repsAchieved: 15, feedback: 'justRight', daysAgo: 2 },
  // Push D — yesterday
  { exerciseId: 'incline-dumbbell-press', loadKg: 22, repsAchieved: 8, feedback: 'justRight', daysAgo: 1 },
  { exerciseId: 'cable-lateral-raise', loadKg: 7.5, repsAchieved: 12, feedback: 'justRight', daysAgo: 1 },
  { exerciseId: 'triceps-pushdown', loadKg: 26.25, repsAchieved: 10, feedback: 'justRight', daysAgo: 1 },
];

const MS_PER_DAY = 86_400_000;

export function buildDemoHistory(nowMs: number): PersistedSessionRow[] {
  return DEMO_LIFTS.map(({ exerciseId, loadKg, repsAchieved, feedback, daysAgo }) => ({
    exerciseId,
    loadKg,
    repsAchieved,
    feedback,
    completedAtIso: new Date(nowMs - daysAgo * MS_PER_DAY).toISOString(),
  }));
}
