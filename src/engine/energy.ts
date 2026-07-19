// Session energy estimate — pure logic. MET definition: 1 MET burns
// ~1 kcal per kg of body mass per hour, so kcal = MET × mass × hours.
// Coarse by design (the user asked for a rough figure now, exact math
// later); the rationale string names every assumption so the number is
// never mistaken for measurement (Exposed Mechanism).

import {
  DEFAULT_BODY_MASS_KG,
  KJ_PER_KCAL,
  MET_RESISTANCE_TRAINING,
} from '@/config/progressionConfig';

const MS_PER_HOUR = 3_600_000;

export interface EnergyEstimate {
  kcal: number;
  kilojoules: number;
  /** The assumptions, spelled out — shown verbatim on the summary screen. */
  rationale: string;
}

export function estimateSessionEnergy(durationMs: number): EnergyEstimate {
  if (durationMs < 0) {
    throw new Error(`estimateSessionEnergy: negative duration (${durationMs} ms)`);
  }
  const hours = durationMs / MS_PER_HOUR;
  const kcal = MET_RESISTANCE_TRAINING * DEFAULT_BODY_MASS_KG * hours;
  return {
    kcal: Math.round(kcal),
    kilojoules: Math.round(kcal * KJ_PER_KCAL),
    rationale: `${MET_RESISTANCE_TRAINING} MET × ${DEFAULT_BODY_MASS_KG} kg (default — profiles will refine) × ${hours.toFixed(2)} h`,
  };
}
