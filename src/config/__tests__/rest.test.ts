import { REST_TIMER_BASE_SEC, restSecForExercise } from '@/config/progressionConfig';
import type { Exercise } from '@/domain/types';

const base: Exercise = {
  id: 'test-lift',
  name: 'Test Lift',
  exerciseClass: 'compound',
  equipment: ['barbell'],
  primaryMuscles: ['back'],
  secondaryMuscles: [],
};

describe('restSecForExercise', () => {
  it('missing restRatio defaults to 1 × base (a missing attribute never breaks)', () => {
    expect(restSecForExercise(base)).toBe(REST_TIMER_BASE_SEC);
  });

  it('scales by the ratio — 0.8 → 48 s, 3 → 180 s', () => {
    expect(restSecForExercise({ ...base, restRatio: 0.8 })).toBe(48);
    expect(restSecForExercise({ ...base, restRatio: 3 })).toBe(180);
  });
});
