// Unit display conversion. Storage, progression, and plate math are ALL kg;
// lb exists only at the moment a number meets the eye. WORKAROUND — this
// solves glanceable lb display for lb-thinking users; it does NOT solve
// lb-native plate increments (a +2.5 kg step reads as +5.5 lb). Root fix:
// per-unit increment tables in progressionConfig when lb users are real.

import type { UnitPreference } from '@/domain/types';

export const LB_PER_KG = 2.20462;

/** Nearest displayable lb value; 0.5 lb matches the finest common plate label. */
const LB_DISPLAY_STEP = 0.5;

/** "22.5" / "50" — trimmed for the hero numeral, no trailing zeros. */
export function formatLoad(loadKg: number, unit: UnitPreference): string {
  if (unit === 'kg') {
    return String(Math.round(loadKg * 100) / 100);
  }
  const lb = Math.round((loadKg * LB_PER_KG) / LB_DISPLAY_STEP) * LB_DISPLAY_STEP;
  return String(Math.round(lb * 10) / 10);
}

export function unitSuffix(unit: UnitPreference): string {
  return unit === 'kg' ? 'KG' : 'LB';
}
