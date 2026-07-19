// Validation for the hand-editable JSON data files (exercises.json,
// gymProfiles.json — format documented in docs/DATA.md). The catalog is
// maintainer-edited, so errors must fail LOUD at startup with the exact
// entry and field named — a silent bad entry would poison fatigue accounting.

import {
  EQUIPMENT_TAGS,
  EXERCISE_CLASSES,
  MUSCLE_COMPONENTS,
  MUSCLE_GROUPS,
  type Exercise,
  type GymProfile,
  type MuscleComponent,
  type ProgressionOverride,
} from '@/domain/types';

/**
 * Authoring slack for contribution sums: shares should describe the whole
 * movement (≈1.0) but hand-edited decimals deserve a little float/rounding
 * grace, not a startup crash.
 */
const CONTRIBUTION_SUM_MIN = 0.95;
const CONTRIBUTION_SUM_MAX = 1.05;

export function validateExercises(raw: unknown): Exercise[] {
  if (!Array.isArray(raw)) {
    throw new Error('exercises.json: top level must be an array');
  }
  const seenIds = new Set<string>();

  return raw.map((entry, index) => {
    const where = `exercises.json[${index}]`;
    const record = asRecord(entry, where);

    const id = requireString(record, 'id', where);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
      throw new Error(`${where}: id "${id}" must be kebab-case (a-z, 0-9, hyphens)`);
    }
    if (seenIds.has(id)) {
      throw new Error(`${where}: duplicate id "${id}"`);
    }
    seenIds.add(id);

    const name = requireString(record, 'name', where);
    const exerciseClass = requireOneOf(record, 'exerciseClass', EXERCISE_CLASSES, where);
    const equipment = requireArrayOf(record, 'equipment', EQUIPMENT_TAGS, where);
    if (equipment.length === 0) {
      throw new Error(`${where} ("${id}"): equipment must list at least one tag`);
    }
    const primaryMuscles = requireArrayOf(record, 'primaryMuscles', MUSCLE_GROUPS, where);
    if (primaryMuscles.length === 0) {
      throw new Error(`${where} ("${id}"): primaryMuscles must not be empty`);
    }
    const secondaryMuscles = requireArrayOf(record, 'secondaryMuscles', MUSCLE_GROUPS, where);
    const tertiaryMuscles =
      record['tertiaryMuscles'] === undefined
        ? undefined
        : requireArrayOf(record, 'tertiaryMuscles', MUSCLE_GROUPS, where);

    const allRoles = [...primaryMuscles, ...secondaryMuscles, ...(tertiaryMuscles ?? [])];
    if (new Set(allRoles).size !== allRoles.length) {
      throw new Error(`${where} ("${id}"): a muscle may appear in only one role`);
    }

    const muscleContributions = optionalContributions(record, `${where} ("${id}")`);
    const progressionOverride = optionalProgressionOverride(record, `${where} ("${id}")`);

    return {
      id,
      name,
      exerciseClass,
      equipment,
      primaryMuscles,
      secondaryMuscles,
      tertiaryMuscles,
      muscleContributions,
      progressionOverride,
    };
  });
}

function optionalContributions(
  record: Record<string, unknown>,
  where: string,
): Partial<Record<MuscleComponent, number>> | undefined {
  const value = record['muscleContributions'];
  if (value === undefined) return undefined;
  const entries = Object.entries(asRecord(value, `${where}: "muscleContributions"`));
  if (entries.length === 0) {
    throw new Error(`${where}: "muscleContributions" must not be empty — omit it instead`);
  }

  let sum = 0;
  const contributions: Partial<Record<MuscleComponent, number>> = {};
  for (const [component, share] of entries) {
    if (!MUSCLE_COMPONENTS.includes(component as MuscleComponent)) {
      throw new Error(
        `${where}: "muscleContributions" has unknown component "${component}" — must be one of: ${MUSCLE_COMPONENTS.join(', ')}`,
      );
    }
    if (typeof share !== 'number' || !(share > 0) || share > 1) {
      throw new Error(
        `${where}: "muscleContributions.${component}" must be a number in (0, 1], got ${String(share)}`,
      );
    }
    contributions[component as MuscleComponent] = share;
    sum += share;
  }
  if (sum < CONTRIBUTION_SUM_MIN || sum > CONTRIBUTION_SUM_MAX) {
    throw new Error(
      `${where}: "muscleContributions" shares sum to ${sum.toFixed(2)} — must total ≈1.0 (${CONTRIBUTION_SUM_MIN}–${CONTRIBUTION_SUM_MAX})`,
    );
  }
  return contributions;
}

function optionalProgressionOverride(
  record: Record<string, unknown>,
  where: string,
): ProgressionOverride | undefined {
  const value = record['progressionOverride'];
  if (value === undefined) return undefined;
  const override = asRecord(value, `${where}: "progressionOverride"`);

  const result: ProgressionOverride = {};
  for (const field of ['repRangeLow', 'repRangeHigh', 'incrementKg'] as const) {
    const fieldValue = override[field];
    if (fieldValue === undefined) continue;
    if (typeof fieldValue !== 'number' || !(fieldValue > 0)) {
      throw new Error(`${where}: "progressionOverride.${field}" must be a positive number`);
    }
    result[field] = fieldValue;
  }
  if (Object.keys(result).length === 0) {
    throw new Error(`${where}: "progressionOverride" must set at least one field — omit it instead`);
  }
  if (
    result.repRangeLow !== undefined &&
    result.repRangeHigh !== undefined &&
    result.repRangeLow >= result.repRangeHigh
  ) {
    throw new Error(`${where}: "progressionOverride" repRangeLow must be below repRangeHigh`);
  }
  return result;
}

export function validateGymProfiles(raw: unknown): GymProfile[] {
  if (!Array.isArray(raw)) {
    throw new Error('gymProfiles.json: top level must be an array');
  }
  if (raw.length === 0) {
    throw new Error('gymProfiles.json: at least one profile is required (app defaults to the first)');
  }
  const seenIds = new Set<string>();

  return raw.map((entry, index) => {
    const where = `gymProfiles.json[${index}]`;
    const record = asRecord(entry, where);
    const id = requireString(record, 'id', where);
    if (seenIds.has(id)) {
      throw new Error(`${where}: duplicate id "${id}"`);
    }
    seenIds.add(id);
    const name = requireString(record, 'name', where);
    const equipment = requireArrayOf(record, 'equipment', EQUIPMENT_TAGS, where);
    if (!equipment.includes('bodyweight')) {
      // Availability is a plain subset check; every gym "has" bodyweight.
      throw new Error(`${where} ("${id}"): equipment must include "bodyweight"`);
    }
    return { id, name, equipment };
  });
}

// ── field helpers ─────────────────────────────────────────────────────

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${where}: entry must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, field: string, where: string): string {
  const value = record[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${where}: "${field}" must be a non-empty string`);
  }
  return value;
}

function requireOneOf<T extends string>(
  record: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
  where: string,
): T {
  const value = record[field];
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${where}: "${field}" must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

function requireArrayOf<T extends string>(
  record: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
  where: string,
): T[] {
  const value = record[field];
  if (!Array.isArray(value)) {
    throw new Error(`${where}: "${field}" must be an array`);
  }
  return value.map((item) => {
    if (typeof item !== 'string' || !allowed.includes(item as T)) {
      throw new Error(
        `${where}: "${field}" contains "${String(item)}" — must be one of: ${allowed.join(', ')}`,
      );
    }
    return item as T;
  });
}
