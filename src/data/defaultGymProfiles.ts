// Default gym profiles (PRD §1). The selected profile globally filters the
// exercise catalog. 'bodyweight' appears in every profile so availability
// stays a plain subset check — no special-casing in the filter.

import type { GymProfile } from '@/domain/types';

export const DEFAULT_GYM_PROFILES: readonly GymProfile[] = [
  {
    id: 'commercial',
    name: 'Commercial Gym',
    equipment: [
      'barbell',
      'dumbbell',
      'kettlebell',
      'machine',
      'cable',
      'bodyweight',
      'bands',
      'bench',
      'rack',
      'pullupBar',
    ],
  },
  {
    id: 'home',
    name: 'Home Gym',
    equipment: ['barbell', 'dumbbell', 'bodyweight', 'bands', 'bench', 'rack', 'pullupBar'],
  },
  {
    id: 'hotel',
    name: 'Hotel Gym',
    equipment: ['dumbbell', 'machine', 'cable', 'bodyweight', 'bench'],
  },
] as const;
