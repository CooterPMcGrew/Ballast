// Exercise catalog, loaded from the hand-editable exercises.json (format:
// docs/DATA.md) and validated at module load — a bad entry fails the app at
// startup with the entry named, never silently.

import rawExercises from '@/data/exercises.json';
import { validateExercises } from '@/data/catalogValidation';
import type { Exercise } from '@/domain/types';

export const EXERCISE_CATALOG: readonly Exercise[] = validateExercises(rawExercises);

/**
 * User-defined exercises, synced here by the store (hydrate + every
 * mutation) so non-reactive lookups resolve them. Reactive lists must
 * subscribe to the store's customExercises — this registry is for id
 * resolution only.
 */
let customRegistry: readonly Exercise[] = [];

export function registerCustomExercises(customExercises: readonly Exercise[]): void {
  customRegistry = customExercises;
}

/** Lookup by id; returns undefined for unknown ids — caller decides severity. */
export function getExerciseById(id: string): Exercise | undefined {
  return (
    EXERCISE_CATALOG.find((exercise) => exercise.id === id) ??
    customRegistry.find((exercise) => exercise.id === id)
  );
}
