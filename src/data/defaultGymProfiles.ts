// Gym profiles (PRD §1), loaded from hand-editable gymProfiles.json (format:
// docs/DATA.md) and validated at module load. The first entry is the default
// profile until persistence restores the last-used one.

import rawProfiles from '@/data/gymProfiles.json';
import { validateGymProfiles } from '@/data/catalogValidation';
import type { GymProfile } from '@/domain/types';

export const DEFAULT_GYM_PROFILES: readonly GymProfile[] = validateGymProfiles(rawProfiles);
