// First-session load seeding (PRD D2): a rough estimate the user corrects at
// the rack via steppers; the Post-Set loop refines it from session one.

import {
  SEED_EQUIPMENT_PRIORITY,
  SEED_LOAD_KG_BY_EQUIPMENT,
} from '@/config/progressionConfig';
import type { Exercise } from '@/domain/types';

export function seedLoadKgForExercise(exercise: Exercise): number {
  const decidingTag = SEED_EQUIPMENT_PRIORITY.find((tag) => exercise.equipment.includes(tag));
  // Support-only equipment (bench/rack) never decides; bodyweight ends the
  // priority list, so an undecided exercise means a catalog entry with no
  // load-bearing tag at all — seed 0 and let the steppers set reality.
  return decidingTag === undefined ? 0 : SEED_LOAD_KG_BY_EQUIPMENT[decidingTag];
}
