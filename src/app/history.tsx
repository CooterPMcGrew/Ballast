import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getExerciseById } from '@/data/exerciseCatalog';
import { formatLoad, unitSuffix } from '@/domain/units';
import { useAppStore } from '@/store/appStore';
import {
  feedbackColor,
  fontFamily,
  fontSize,
  palette,
  pressFeedback,
  spacing,
  touchTarget,
} from '@/theme/tokens';

/**
 * Workout history — every recorded lift, newest day first, in the same
 * visual language as the session SET LOG (left edge = how it felt).
 *
 * Editing is limited to deletion, and deliberately so: a mis-entered lift
 * sits at the tail of its exercise's history and drives every future
 * prescription for that movement, so repair must exist — but a *rewritten*
 * lift would be training data the user invented after the fact. Erase and
 * re-log is the honest path. The two-tap confirm is the guard.
 */
export default function HistoryScreen() {
  const historyByExercise = useAppStore((state) => state.sessionHistoryByExercise);
  const unitPreference = useAppStore((state) => state.unitPreference);
  const deleteHistoryEntry = useAppStore((state) => state.deleteHistoryEntry);

  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // `index` is the lift's position in its exercise's history — the identity
  // the store deletes by. Deleting shifts later indices, so the confirm
  // state is cleared on every delete.
  const lifts = Object.entries(historyByExercise)
    .flatMap(([exerciseId, rows]) =>
      rows.map((row, index) => ({
        exerciseId,
        index,
        name: getExerciseById(exerciseId)?.name ?? exerciseId,
        ...row,
      })),
    )
    .sort((a, b) => Date.parse(b.completedAtIso) - Date.parse(a.completedAtIso));

  const onDelete = async (exerciseId: string, index: number) => {
    const key = `${exerciseId}:${index}`;
    if (confirmingKey !== key) {
      setConfirmingKey(key);
      return;
    }
    setConfirmingKey(null);
    const deleted = await deleteHistoryEntry(exerciseId, index);
    setStatus(deleted ? null : 'delete failed — the lift is still on disk, see logs');
  };

  // Group by local calendar day, newest first (lifts are already sorted).
  const days: { day: string; volumeKg: number; entries: typeof lifts }[] = [];
  for (const lift of lifts) {
    const day = new Date(lift.completedAtIso).toDateString().toUpperCase();
    const bucket = days[days.length - 1];
    if (bucket && bucket.day === day) {
      bucket.entries.push(lift);
      bucket.volumeKg += lift.loadKg * lift.repsAchieved;
    } else {
      days.push({ day, volumeKg: lift.loadKg * lift.repsAchieved, entries: [lift] });
    }
  }

  const displayVolume = (kg: number) =>
    `${formatLoad(kg, unitPreference)} ${unitSuffix(unitPreference)}`;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable
          testID="history-back"
          onPress={() => router.back()}
          style={(state) => [styles.backButton, pressFeedback(state)]}
        >
          <Text style={styles.backButtonLabel}>‹ HOME</Text>
        </Pressable>

        <Text style={styles.kicker}>WORKOUT HISTORY</Text>

        {/* The on-ramp for a paper logbook, and the repair path for a session
            trained without the phone. Logged lifts progress like tracked ones. */}
        <Pressable
          testID="log-past-workout"
          onPress={() => router.push('/log')}
          style={(state) => [styles.logButton, pressFeedback(state)]}
        >
          <Text style={styles.logLabel}>+ LOG PAST WORKOUT</Text>
        </Pressable>

        {days.length === 0 && (
          <Text style={styles.emptyNote}>
            nothing recorded yet — train, or log a workout you already did
          </Text>
        )}

        {status && <Text style={styles.hazardNote}>{status}</Text>}

        {days.map(({ day, volumeKg, entries }) => (
          <View key={day} style={styles.dayBlock}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{day}</Text>
              <Text style={styles.dayVolume}>{displayVolume(volumeKg)}</Text>
            </View>
            {entries.map((lift, position) => {
              const key = `${lift.exerciseId}:${lift.index}`;
              const confirming = confirmingKey === key;
              return (
                <View
                  key={`${lift.completedAtIso}-${position}`}
                  style={[styles.liftRow, { borderLeftColor: feedbackColor[lift.feedback] }]}
                >
                  <View style={styles.liftInfo}>
                    <Text style={styles.liftName}>{lift.name}</Text>
                    <Text style={styles.liftStats}>
                      {formatLoad(lift.loadKg, unitPreference)} {unitSuffix(unitPreference)} ×{' '}
                      {lift.repsAchieved}
                    </Text>
                  </View>
                  <Pressable
                    testID={`delete-lift-${key}`}
                    onPress={() => void onDelete(lift.exerciseId, lift.index)}
                    style={(state) => [styles.deleteButton, pressFeedback(state)]}
                  >
                    <Text style={[styles.deleteLabel, confirming && styles.deleteLabelConfirming]}>
                      {confirming ? 'SURE?' : 'DELETE'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.gunmetal,
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  backButton: {
    minHeight: touchTarget.secondaryMinPt,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingRight: spacing.md,
  },
  backButtonLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 1,
  },
  kicker: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 2,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  logButton: {
    minHeight: touchTarget.secondaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.schematicCyan,
    borderRadius: 4,
    backgroundColor: palette.surface,
    marginBottom: spacing.lg,
  },
  logLabel: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 1,
  },
  emptyNote: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
  },
  // Hazard is semantic: the lift the user tried to erase is still on disk.
  hazardNote: {
    color: palette.hazard,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginBottom: spacing.md,
  },
  dayBlock: {
    marginBottom: spacing.lg,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.slate,
    paddingBottom: spacing.xs,
    marginBottom: spacing.sm,
  },
  dayTitle: {
    color: palette.copper,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 2,
  },
  dayVolume: {
    color: palette.textPrimary,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
  },
  liftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  liftInfo: {
    flex: 1,
  },
  // Slate until armed, then hazard — the palette's "about to destroy
  // something" signal, never decorative.
  deleteButton: {
    minHeight: touchTarget.secondaryMinPt,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  deleteLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 1,
  },
  deleteLabelConfirming: {
    color: palette.hazard,
  },
  liftName: {
    color: palette.textPrimary,
    fontFamily: fontFamily.displayRegular,
    fontSize: fontSize.body,
  },
  liftStats: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: 2,
  },
});
