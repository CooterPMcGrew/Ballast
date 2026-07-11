import { DEFAULT_GYM_PROFILES } from '@/data/defaultGymProfiles';
import { EXERCISE_CATALOG } from '@/data/exerciseCatalog';
import { filterAvailableExercises, isExerciseAvailable } from '@/domain/equipment';

function profile(id: string) {
  const found = DEFAULT_GYM_PROFILES.find((p) => p.id === id);
  if (!found) throw new Error(`missing default profile: ${id}`);
  return found;
}

describe('equipment filtering', () => {
  it('hotel gym excludes barbell and rack movements', () => {
    const available = filterAvailableExercises(EXERCISE_CATALOG, profile('hotel'));
    const ids = available.map((e) => e.id);
    expect(ids).not.toContain('barbell-back-squat');
    expect(ids).not.toContain('deadlift');
    expect(ids).toContain('dumbbell-bench-press');
    expect(ids).toContain('leg-press');
  });

  it('commercial gym covers the entire catalog', () => {
    const available = filterAvailableExercises(EXERCISE_CATALOG, profile('commercial'));
    expect(available.length).toBe(EXERCISE_CATALOG.length);
  });

  it('requires ALL tags, not just one', () => {
    // Pull-up needs bodyweight AND pullupBar; hotel has only bodyweight.
    const pullUp = EXERCISE_CATALOG.find((e) => e.id === 'pull-up');
    expect(pullUp).toBeDefined();
    expect(isExerciseAvailable(pullUp!, profile('hotel'))).toBe(false);
    expect(isExerciseAvailable(pullUp!, profile('home'))).toBe(true);
  });
});

describe('catalog integrity', () => {
  it('ids are unique', () => {
    const ids = EXERCISE_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every exercise names at least one primary muscle', () => {
    for (const exercise of EXERCISE_CATALOG) {
      expect(exercise.primaryMuscles.length).toBeGreaterThan(0);
    }
  });

  it('no muscle appears in two roles on the same exercise', () => {
    for (const exercise of EXERCISE_CATALOG) {
      const all = [
        ...exercise.primaryMuscles,
        ...exercise.secondaryMuscles,
        ...(exercise.tertiaryMuscles ?? []),
      ];
      expect(new Set(all).size).toBe(all.length);
    }
  });
});
