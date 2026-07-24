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
  // Bad entries are dropped loudly, never thrown (demo feedback: a typo in
  // one entry must not brick the app). Silence the expected noise.
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => consoleError.mockRestore());

  it('accepts a valid entry', () => {
    expect(validateExercises([validExercise])[0]?.id).toBe('test-move');
  });

  function expectDropped(badEntry: unknown, reason: RegExp) {
    const result = validateExercises([badEntry, { ...validExercise, id: 'survivor' }]);
    expect(result.map((exercise) => exercise.id)).toEqual(['survivor']);
    expect(consoleError).toHaveBeenCalledWith(expect.stringMatching(reason));
  }

  it('drops an entry with a bad field, names it, keeps the rest', () => {
    expectDropped(
      { ...validExercise, equipment: ['flux-capacitor'] },
      /exercises\.json\[0\].*equipment.*flux-capacitor/,
    );
  });

  it('drops an entry missing a required attribute, keeps the rest', () => {
    const { name: _dropped, ...missingName } = validExercise;
    expectDropped(missingName, /name/);
  });

  it('drops duplicate ids, keeps the first', () => {
    const result = validateExercises([validExercise, validExercise]);
    expect(result).toHaveLength(1);
    expect(consoleError).toHaveBeenCalledWith(expect.stringMatching(/duplicate id/));
  });

  it('drops non-kebab-case ids', () => {
    expectDropped({ ...validExercise, id: 'Test Move' }, /kebab-case/);
  });

  it('drops empty primaryMuscles', () => {
    expectDropped({ ...validExercise, primaryMuscles: [] }, /primaryMuscles/);
  });

  it('drops a muscle appearing in two roles', () => {
    expectDropped({ ...validExercise, secondaryMuscles: ['chest'] }, /only one role/);
  });

  it('still throws when nothing valid survives — an unusable catalog is fatal', () => {
    expect(() => validateExercises([{ id: 'broken' }])).toThrow(/no valid entries/);
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
