// Equipment availability (PRD §1): an exercise is doable only when the active
// gym profile covers EVERY tag the movement requires.

import type { EquipmentTag, Exercise, GymProfile } from '@/domain/types';

/**
 * One-tap starting points for the custom gym checklist. Deliberately
 * minimal — a preset seeds the list, the user toggles from there (e.g. add
 * "bench" if their dumbbell setup has one).
 */
export const CUSTOM_GYM_PRESETS: Record<string, EquipmentTag[]> = {
  'DUMBBELLS ONLY': ['dumbbell', 'bodyweight'],
  CALISTHENICS: ['bodyweight', 'pullupBar'],
};

export function isExerciseAvailable(exercise: Exercise, profile: GymProfile): boolean {
  return exercise.equipment.every((tag) => profile.equipment.includes(tag));
}

export function filterAvailableExercises(
  catalog: readonly Exercise[],
  profile: GymProfile,
): Exercise[] {
  return catalog.filter((exercise) => isExerciseAvailable(exercise, profile));
}
