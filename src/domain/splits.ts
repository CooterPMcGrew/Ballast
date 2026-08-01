// Split naming — pure logic, shared by the session picker and the split
// editor so a split reads the same wherever it appears.

import { SPLIT_PRESETS, type CustomSplit, type MuscleGroup } from '@/domain/types';

/**
 * Groups spelled out in a derived name before it collapses to a count.
 * Past three, a chip label stops being glanceable and starts wrapping.
 */
const DERIVED_NAME_MAX_GROUPS = 3;

/**
 * The name a split gets when the user doesn't type one: "BACK + GLUTES".
 * Naming is optional by design — picking the muscles IS the intent, and a
 * forced text field would be the one thing standing between a tired user
 * and a workout.
 */
export function deriveSplitName(groups: readonly MuscleGroup[]): string {
  if (groups.length === 0) return '';
  const named = groups.slice(0, DERIVED_NAME_MAX_GROUPS).map((group) => group.toUpperCase());
  const hidden = groups.length - named.length;
  return hidden > 0 ? `${named.join(' + ')} +${hidden}` : named.join(' + ');
}

/**
 * What to call a session whose focus is this exact group set. Stock preset
 * names win over user splits: the focus arrives as a bare group list (the
 * URL carries no split id), so a deterministic rule beats guessing which
 * chip was tapped. Falls through to the derived name for an ad-hoc focus,
 * e.g. the single-muscle grid.
 */
export function focusLabelForGroups(
  groups: readonly MuscleGroup[],
  customSplits: readonly CustomSplit[],
): string {
  const key = groups.join(',');
  const preset = Object.entries(SPLIT_PRESETS).find(([, preset]) => preset.join(',') === key);
  if (preset) return preset[0];
  const custom = customSplits.find((split) => split.muscleGroups.join(',') === key);
  if (custom) return custom.name.toUpperCase();
  return deriveSplitName(groups);
}
