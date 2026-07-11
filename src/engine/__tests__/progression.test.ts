// Branch-table tests for the progression engine. Config values are imported,
// not restated, so tuning progressionConfig.ts does not silently break tests
// that only care about branch behavior.

import {
  DELOAD_FRACTION,
  EASY_INCREMENT_MULTIPLIER,
  EASY_REP_JUMP,
  GRIND_REPEAT_TRIGGER_COUNT,
  PROGRESSION_BY_CLASS,
} from '@/config/progressionConfig';
import {
  prescribeNextSession,
  seedPlan,
  worstFeedback,
  type ExerciseSessionResult,
} from '@/engine/progression';

const COMPOUND = PROGRESSION_BY_CLASS.compound;

function session(
  loadKg: number,
  repsAchieved: number,
  feedback: ExerciseSessionResult['feedback'],
): ExerciseSessionResult {
  return { loadKg, repsAchieved, feedback };
}

describe('worstFeedback', () => {
  it('lets the worst set govern the session', () => {
    expect(worstFeedback(['easy', 'justRight', 'grind'])).toBe('grind');
    expect(worstFeedback(['easy', 'justRight'])).toBe('justRight');
    expect(worstFeedback(['easy', 'easy'])).toBe('easy');
  });

  it('refuses an empty session', () => {
    expect(() => worstFeedback([])).toThrow('no set feedback');
  });
});

describe('seedPlan', () => {
  it('starts at the rep floor with the supplied load', () => {
    const plan = seedPlan('compound', 60);
    expect(plan.loadKg).toBe(60);
    expect(plan.targetReps).toBe(COMPOUND.repRangeLow);
    expect(plan.rationale).toContain('baseline');
  });
});

describe('prescribeNextSession', () => {
  it('throws on empty history — seeding must be explicit', () => {
    expect(() => prescribeNextSession('compound', [])).toThrow('seedPlan');
  });

  it('justRight below ceiling → +1 rep, same load', () => {
    const plan = prescribeNextSession('compound', [session(100, 7, 'justRight')]);
    expect(plan).toMatchObject({ loadKg: 100, targetReps: 8 });
    expect(plan.rationale).toContain('+1 rep');
  });

  it('justRight at ceiling → +increment, reps back to floor', () => {
    const plan = prescribeNextSession('compound', [
      session(100, COMPOUND.repRangeHigh, 'justRight'),
    ]);
    expect(plan).toMatchObject({
      loadKg: 100 + COMPOUND.incrementKg,
      targetReps: COMPOUND.repRangeLow,
    });
  });

  it('easy below ceiling → aggressive rep jump, capped at ceiling', () => {
    const plan = prescribeNextSession('compound', [session(100, 7, 'easy')]);
    expect(plan.targetReps).toBe(Math.min(7 + EASY_REP_JUMP, COMPOUND.repRangeHigh));
    expect(plan.loadKg).toBe(100);

    const nearCeiling = prescribeNextSession('compound', [
      session(100, COMPOUND.repRangeHigh - 1, 'easy'),
    ]);
    expect(nearCeiling.targetReps).toBe(COMPOUND.repRangeHigh);
  });

  it('easy at ceiling → multiplied increment, reps back to floor', () => {
    const plan = prescribeNextSession('compound', [session(100, COMPOUND.repRangeHigh, 'easy')]);
    expect(plan).toMatchObject({
      loadKg: 100 + COMPOUND.incrementKg * EASY_INCREMENT_MULTIPLIER,
      targetReps: COMPOUND.repRangeLow,
    });
    expect(plan.rationale).toContain('felt easy');
  });

  it('single grind → repeat the same work, progression halted', () => {
    const plan = prescribeNextSession('compound', [session(100, 6, 'grind')]);
    expect(plan).toMatchObject({ loadKg: 100, targetReps: 6 });
    expect(plan.rationale).toContain('repeat');
  });

  it('grind streak at trigger count → deload by DELOAD_FRACTION', () => {
    const history = Array.from({ length: GRIND_REPEAT_TRIGGER_COUNT }, () =>
      session(100, 6, 'grind'),
    );
    const plan = prescribeNextSession('compound', history);
    expect(plan.loadKg).toBe(100 * (1 - DELOAD_FRACTION));
    expect(plan.targetReps).toBe(COMPOUND.repRangeLow);
    expect(plan.rationale).toContain('deload');
  });

  it('deload rounds DOWN to a loadable step, never up', () => {
    // 62.5 × 0.9 = 56.25 → floor to 2.5 kg step = 55, not 57.5.
    const history = Array.from({ length: GRIND_REPEAT_TRIGGER_COUNT }, () =>
      session(62.5, 6, 'grind'),
    );
    const plan = prescribeNextSession('compound', history);
    expect(plan.loadKg).toBe(55);
  });

  it('still grinding after a deload → cuts again at the next multiple', () => {
    const history = Array.from({ length: GRIND_REPEAT_TRIGGER_COUNT * 2 }, () =>
      session(100, 6, 'grind'),
    );
    const plan = prescribeNextSession('compound', history);
    expect(plan.rationale).toContain('deload');
  });

  it('grind streak broken by a good session does not deload', () => {
    const plan = prescribeNextSession('compound', [
      session(100, 6, 'grind'),
      session(100, 6, 'justRight'),
      session(100, 6, 'grind'),
    ]);
    expect(plan.rationale).toContain('repeat');
    expect(plan.loadKg).toBe(100);
  });

  it('bodyweight grind streak drops reps to floor instead of cutting load', () => {
    const history = Array.from({ length: GRIND_REPEAT_TRIGGER_COUNT }, () =>
      session(0, 8, 'grind'),
    );
    const plan = prescribeNextSession('compound', history);
    expect(plan.loadKg).toBe(0);
    expect(plan.targetReps).toBe(COMPOUND.repRangeLow);
  });

  it('isolation class uses its own window and increment', () => {
    const ISOLATION = PROGRESSION_BY_CLASS.isolation;
    const plan = prescribeNextSession('isolation', [
      session(20, ISOLATION.repRangeHigh, 'justRight'),
    ]);
    expect(plan).toMatchObject({
      loadKg: 20 + ISOLATION.incrementKg,
      targetReps: ISOLATION.repRangeLow,
    });
  });
});
