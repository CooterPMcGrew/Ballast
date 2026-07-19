import {
  DEFAULT_BODY_MASS_KG,
  KJ_PER_KCAL,
  MET_RESISTANCE_TRAINING,
} from '@/config/progressionConfig';
import { estimateSessionEnergy } from '@/engine/energy';

describe('estimateSessionEnergy', () => {
  it('applies kcal = MET × mass × hours, converted to kJ', () => {
    const oneHourMs = 3_600_000;
    const estimate = estimateSessionEnergy(oneHourMs);
    const expectedKcal = MET_RESISTANCE_TRAINING * DEFAULT_BODY_MASS_KG;
    expect(estimate.kcal).toBe(Math.round(expectedKcal));
    expect(estimate.kilojoules).toBe(Math.round(expectedKcal * KJ_PER_KCAL));
  });

  it('names its assumptions — the estimate must never look like measurement', () => {
    const estimate = estimateSessionEnergy(1_800_000);
    expect(estimate.rationale).toContain('MET');
    expect(estimate.rationale).toContain('default');
  });

  it('refuses a negative duration', () => {
    expect(() => estimateSessionEnergy(-1)).toThrow('negative duration');
  });
});
