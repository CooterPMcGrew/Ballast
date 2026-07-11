// Equipment availability (PRD §1): an exercise is doable only when the active
// gym profile covers EVERY tag the movement requires.

import type { Exercise, GymProfile } from '@/domain/types';

export function isExerciseAvailable(exercise: Exercise, profile: GymProfile): boolean {
  return exercise.equipment.every((tag) => profile.equipment.includes(tag));
}

export function filterAvailableExercises(
  catalog: readonly Exercise[],
  profile: GymProfile,
): Exercise[] {
  return catalog.filter((exercise) => isExerciseAvailable(exercise, profile));
}
