import { formatLoad, LOAD_STEP_LB, steppedLoadKg, unitSuffix } from '@/domain/units';

describe('formatLoad', () => {
  it('kg passes through, trimmed', () => {
    expect(formatLoad(22.5, 'kg')).toBe('22.5');
    expect(formatLoad(60, 'kg')).toBe('60');
  });

  it('lb converts and snaps to 0.5 lb display steps', () => {
    // 20 kg × 2.20462 = 44.09 → 44 lb even.
    expect(formatLoad(20, 'lb')).toBe('44');
    // 2.5 kg × 2.20462 = 5.51 → 5.5 lb.
    expect(formatLoad(2.5, 'lb')).toBe('5.5');
  });

  it('suffix matches the preference', () => {
    expect(unitSuffix('kg')).toBe('KG');
    expect(unitSuffix('lb')).toBe('LB');
  });
});

describe('steppedLoadKg', () => {
  const COMPOUND_STEP_KG = 2.5;

  it('kg mode adds the exercise increment', () => {
    expect(steppedLoadKg(60, 1, 'kg', COMPOUND_STEP_KG)).toBe(62.5);
    expect(steppedLoadKg(60, -1, 'kg', COMPOUND_STEP_KG)).toBe(57.5);
  });

  it('lb mode walks the 2.5 lb grid regardless of the kg increment', () => {
    // 135 lb is the start; ten presses must land exactly on 160 lb.
    let loadKg = 135 / 2.20462;
    for (let press = 0; press < 10; press++) {
      loadKg = steppedLoadKg(loadKg, 1, 'lb', COMPOUND_STEP_KG);
      expect(formatLoad(loadKg, 'lb')).toBe(String(135 + LOAD_STEP_LB * (press + 1)));
    }
  });

  it('lb mode is exactly reversible — no drift from repeated round trips', () => {
    let loadKg = 100 / 2.20462;
    for (let press = 0; press < 20; press++) {
      loadKg = steppedLoadKg(loadKg, 1, 'lb', COMPOUND_STEP_KG);
      loadKg = steppedLoadKg(loadKg, -1, 'lb', COMPOUND_STEP_KG);
    }
    expect(formatLoad(loadKg, 'lb')).toBe('100');
  });

  it('lb mode pulls an off-grid kg load onto the grid in the pressed direction', () => {
    // 60 kg = 132.28 lb: up lands on 132.5, down on 130 — both loadable.
    expect(formatLoad(steppedLoadKg(60, 1, 'lb', COMPOUND_STEP_KG), 'lb')).toBe('132.5');
    expect(formatLoad(steppedLoadKg(60, -1, 'lb', COMPOUND_STEP_KG), 'lb')).toBe('130');
  });

  it('never goes below zero in either unit', () => {
    expect(steppedLoadKg(0, -1, 'lb', COMPOUND_STEP_KG)).toBe(0);
    expect(steppedLoadKg(1, -1, 'kg', COMPOUND_STEP_KG)).toBe(0);
  });
});
