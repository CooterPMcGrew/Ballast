// Haptic vocabulary — three physical sensations, each meaning one thing.
// More would blur into noise; the point is that your hand learns the
// grammar. No-ops on web (no hardware) and never throws: a failed buzz
// must not interrupt a workout.

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const canBuzz = Platform.OS !== 'web';

/** Light tick — a set was completed (the COMPLETE tap landed). */
export function buzzSetDone(): void {
  if (!canBuzz) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** Firmer tap — a Post-Set verdict was recorded; the engine has spoken. */
export function buzzVerdict(): void {
  if (!canBuzz) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

/** Success pattern — rest is over, back under the bar. */
export function buzzRestOver(): void {
  if (!canBuzz) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
