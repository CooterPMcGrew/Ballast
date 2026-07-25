import { router } from 'expo-router';
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
 * Read-only by design: history is a record, not a draft.
 */
export default function HistoryScreen() {
  const historyByExercise = useAppStore((state) => state.sessionHistoryByExercise);
  const unitPreference = useAppStore((state) => state.unitPreference);

  const lifts = Object.entries(historyByExercise)
    .flatMap(([exerciseId, rows]) =>
      rows.map((row) => ({
        exerciseId,
        name: getExerciseById(exerciseId)?.name ?? exerciseId,
        ...row,
      })),
    )
    .sort((a, b) => Date.parse(b.completedAtIso) - Date.parse(a.completedAtIso));

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

        {days.length === 0 && (
          <Text style={styles.emptyNote}>
            nothing recorded yet — train, or load demo history in settings
          </Text>
        )}

        {days.map(({ day, volumeKg, entries }) => (
          <View key={day} style={styles.dayBlock}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{day}</Text>
              <Text style={styles.dayVolume}>{displayVolume(volumeKg)}</Text>
            </View>
            {entries.map((lift, index) => (
              <View
                key={`${lift.completedAtIso}-${index}`}
                style={[styles.liftRow, { borderLeftColor: feedbackColor[lift.feedback] }]}
              >
                <Text style={styles.liftName}>{lift.name}</Text>
                <Text style={styles.liftStats}>
                  {formatLoad(lift.loadKg, unitPreference)} {unitSuffix(unitPreference)} ×{' '}
                  {lift.repsAchieved}
                </Text>
              </View>
            ))}
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
  emptyNote: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
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
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
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
