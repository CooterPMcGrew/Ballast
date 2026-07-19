import { formatLoad, unitSuffix } from '@/domain/units';

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
