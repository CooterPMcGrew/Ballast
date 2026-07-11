// Exercise catalog, loaded from the hand-editable exercises.json (format:
// docs/DATA.md) and validated at module load — a bad entry fails the app at
// startup with the entry named, never silently.

import rawExercises from '@/data/exercises.json';
import { validateExercises } from '@/data/catalogValidation';
import type { Exercise } from '@/domain/types';

export const EXERCISE_CATALOG: readonly Exercise[] = validateExercises(rawExercises);

/** Lookup by id; returns undefined for unknown ids — caller decides severity. */
export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISE_CATALOG.find((exercise) => exercise.id === id);
}
