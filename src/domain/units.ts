// Unit boundary. Storage, progression, and plate math are ALL kg; lb exists
// at the display boundary — and, since LOAD_STEP_LB below, at the manual
// stepper, so an lb user's +/- lands on weights their gym can actually load.
// Engine-prescribed jumps remain kg-native (a class increment of 2.5 kg still
// reads as +5.5 lb); per-unit progression increments are the remaining half
// of that root fix and are a separate, deliberate step.

import type { UnitPreference } from '@/domain/types';

export const LB_PER_KG = 2.20462;

/** Nearest displayable lb value; 0.5 lb matches the finest common plate label. */
const LB_DISPLAY_STEP = 0.5;

/**
 * Manual stepper grid for lb users: 2.5 lb = one 1.25 lb plate per side, the
 * finest jump a gym with fractional plates can load. Flat across exercise
 * classes by maintainer decision — in lb mode the button means "one small
 * plate pair", not "the class increment converted". kg mode keeps the
 * per-exercise increment from progressionConfig.
 */
export const LOAD_STEP_LB = 2.5;

/**
 * Grid tolerance. A kg→lb round trip lands ~1e-13 off an exact multiple, and
 * without this a floor()/ceil() on that value skips a whole 2.5 lb step.
 */
const GRID_EPSILON = 1e-6;

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

/**
 * Where one LOAD stepper press lands, in stored kg.
 *
 * lb mode snaps to the LOAD_STEP_LB grid in DISPLAY units, so repeated
 * presses walk 135 → 137.5 → 140 lb exactly instead of drifting off a
 * kg-native step. Because every press re-derives from the stored kg, the
 * conversion error never accumulates. A load that starts off-grid (anything
 * the engine prescribed in kg) moves to the next grid line in the pressed
 * direction — less than a full step, deliberately: the next line is the next
 * weight the user can actually load.
 *
 * kg mode is unchanged: add or subtract the exercise's own increment.
 */
export function steppedLoadKg(
  loadKg: number,
  direction: 1 | -1,
  unit: UnitPreference,
  stepKg: number,
): number {
  if (unit === 'kg') {
    return Math.max(0, loadKg + direction * stepKg);
  }
  const lines = (loadKg * LB_PER_KG) / LOAD_STEP_LB;
  const nextLine =
    direction === 1
      ? Math.floor(lines + GRID_EPSILON) + 1
      : Math.ceil(lines - GRID_EPSILON) - 1;
  return Math.max(0, (nextLine * LOAD_STEP_LB) / LB_PER_KG);
}
