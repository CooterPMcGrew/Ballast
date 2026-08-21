import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
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
 *
 * SectionList, not ScrollView: this list has no ceiling. A year of training
 * is several hundred rows, and a ScrollView mounts every one of them before
 * it can paint the first.
 */

interface Lift {
  exerciseId: string;
  /** Position in this exercise's history — the identity the store deletes by. */
  index: number;
  name: string;
  loadKg: number;
  repsAchieved: number;
  feedback: keyof typeof feedbackColor;
  completedAtIso: string;
}

interface DaySection {
  title: string;
  volumeKg: number;
  data: Lift[];
}

export default function HistoryScreen() {
  const historyByExercise = useAppStore((state) => state.sessionHistoryByExercise);
  const unitPreference = useAppStore((state) => state.unitPreference);
  const deleteHistoryEntry = useAppStore((state) => state.deleteHistoryEntry);

  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Deleting shifts later indices, so the confirm state is cleared on every
  // delete rather than left pointing at a row that has moved.
  const lifts: Lift[] = Object.entries(historyByExercise)
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
  const sections: DaySection[] = [];
  for (const lift of lifts) {
    const title = new Date(lift.completedAtIso).toDateString().toUpperCase();
    const bucket = sections[sections.length - 1];
    const volume = lift.loadKg * lift.repsAchieved;
    if (bucket && bucket.title === title) {
      bucket.data.push(lift);
      bucket.volumeKg += volume;
    } else {
      sections.push({ title, volumeKg: volume, data: [lift] });
    }
  }

  const displayVolume = (kg: number) =>
    `${formatLoad(kg, unitPreference)} ${unitSuffix(unitPreference)}`;

  return (
    <SafeAreaView style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(lift) => `${lift.exerciseId}:${lift.index}`}
        contentContainerStyle={styles.scroll}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <>
            <ScreenHeader
              title="WORKOUT HISTORY"
              back={{ label: 'HOME', onPress: () => router.back() }}
            />

            {/* The on-ramp for a paper logbook, and the repair path for a
                session trained without the phone. Logged lifts progress
                like tracked ones. */}
            <Pressable
              testID="log-past-workout"
              onPress={() => router.push('/log')}
              accessibilityRole="button"
              accessibilityLabel="Log a workout you already did"
              style={(state) => [styles.logButton, pressFeedback(state)]}
            >
              <Text style={styles.logLabel}>+ LOG PAST WORKOUT</Text>
            </Pressable>

            {status && <Text style={styles.hazardNote}>{status}</Text>}
          </>
        }
        ListEmptyComponent={
          <Text style={styles.emptyNote}>
            nothing recorded yet — train, or log a workout you already did
          </Text>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <Text style={styles.dayTitle}>{section.title}</Text>
            <Text style={styles.dayVolume}>{displayVolume(section.volumeKg)}</Text>
          </View>
        )}
        renderItem={({ item: lift }) => {
          const key = `${lift.exerciseId}:${lift.index}`;
          const confirming = confirmingKey === key;
          const stats = `${formatLoad(lift.loadKg, unitPreference)} ${unitSuffix(unitPreference)} × ${lift.repsAchieved}`;
          return (
            <View style={[styles.liftRow, { borderLeftColor: feedbackColor[lift.feedback] }]}>
              <View style={styles.liftInfo} accessibilityLabel={`${lift.name}, ${stats}`}>
                <Text style={styles.liftName}>{lift.name}</Text>
                <Text style={styles.liftStats}>{stats}</Text>
              </View>
              <Pressable
                testID={`delete-lift-${key}`}
                onPress={() => void onDelete(lift.exerciseId, lift.index)}
                accessibilityRole="button"
                accessibilityLabel={
                  confirming
                    ? `Confirm deleting ${lift.name}, ${stats}`
                    : `Delete ${lift.name}, ${stats}`
                }
                style={(state) => [styles.deleteButton, pressFeedback(state)]}
              >
                <Text style={[styles.deleteLabel, confirming && styles.deleteLabelConfirming]}>
                  {confirming ? 'SURE?' : 'DELETE'}
                </Text>
              </Pressable>
            </View>
          );
        }}
        SectionSeparatorComponent={null}
      />
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
    flexGrow: 1,
  },
  logButton: {
    minHeight: touchTarget.secondaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.schematicCyan,
    borderRadius: 4,
    backgroundColor: palette.surface,
    marginBottom: spacing.md,
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
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.slate,
    backgroundColor: palette.gunmetal,
    paddingBottom: spacing.xs,
    marginTop: spacing.lg,
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
