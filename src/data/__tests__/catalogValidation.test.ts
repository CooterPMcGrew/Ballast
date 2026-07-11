import { validateExercises, validateGymProfiles } from '@/data/catalogValidation';

const validExercise = {
  id: 'test-move',
  name: 'Test Move',
  exerciseClass: 'compound',
  equipment: ['barbell'],
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps'],
};

describe('validateExercises', () => {
  it('accepts a valid entry', () => {
    expect(validateExercises([validExercise])[0]?.id).toBe('test-move');
  });

  it('names the entry and field on failure', () => {
    expect(() => validateExercises([{ ...validExercise, equipment: ['flux-capacitor'] }])).toThrow(
      /exercises\.json\[0\].*equipment.*flux-capacitor/,
    );
  });

  it('rejects duplicate ids', () => {
    expect(() => validateExercises([validExercise, validExercise])).toThrow(/duplicate id/);
  });

  it('rejects non-kebab-case ids', () => {
    expect(() => validateExercises([{ ...validExercise, id: 'Test Move' }])).toThrow(/kebab-case/);
  });

  it('rejects empty primaryMuscles', () => {
    expect(() => validateExercises([{ ...validExercise, primaryMuscles: [] }])).toThrow(
      /primaryMuscles/,
    );
  });

  it('rejects a muscle appearing in two roles', () => {
    expect(() =>
      validateExercises([{ ...validExercise, secondaryMuscles: ['chest'] }]),
    ).toThrow(/only one role/);
  });
});

describe('validateGymProfiles', () => {
  it('requires bodyweight in every profile', () => {
    expect(() =>
      validateGymProfiles([{ id: 'x', name: 'X', equipment: ['barbell'] }]),
    ).toThrow(/bodyweight/);
  });

  it('rejects an empty profile list', () => {
    expect(() => validateGymProfiles([])).toThrow(/at least one profile/);
  });
});
