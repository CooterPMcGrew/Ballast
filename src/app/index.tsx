import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyHeatMap } from '@/components/BodyHeatMap';
import { ScreenHeader } from '@/components/ScreenHeader';
import { VolumeChart } from '@/components/VolumeChart';
import { HOME_CHART_DAYS, MUSCLE_RECENCY_FADE_DAYS } from '@/config/progressionConfig';
import { getExerciseById } from '@/data/exerciseCatalog';
import { useNow } from '@/hooks/useNow';
import { muscleRecency, type TimestampedLift } from '@/engine/recency';
import type { VolumeRow } from '@/engine/history';
import { useAppStore } from '@/store/appStore';
import {
  fontFamily,
  fontSize,
  palette,
  pressFeedback,
  spacing,
  touchTarget,
} from '@/theme/tokens';

/**
 * Home is a status board, nothing else: the recency figure, the volume
 * history, one START SESSION action. All choices (gym, muscle group) live
 * inside the session flow — the tired user opens the app and hits one
 * 64pt button.
 */
export default function HomeScreen() {
  const historyByExercise = useAppStore((state) => state.sessionHistoryByExercise);
  const unitPreference = useAppStore((state) => state.unitPreference);
  const activeSession = useAppStore((state) => state.activeSession);
  const nowMs = useNow();

  // Recency input: every timestamped lift whose exercise still exists
  // (renamed/deleted catalog ids drop out rather than crashing Home).
  const lifts: TimestampedLift[] = Object.entries(historyByExercise).flatMap(([id, rows]) => {
    const exercise = getExerciseById(id);
    return exercise
      ? rows.map((row) => ({ exercise, completedAtIso: row.completedAtIso }))
      : [];
  });
  const recency = muscleRecency(lifts, nowMs);
  const volumeRows: VolumeRow[] = Object.values(historyByExercise).flat();
  const neverTrained = lifts.length === 0;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader
          title="BALLAST"
          right={
            <Pressable
              testID="open-settings"
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              style={(state) => [styles.settingsButton, pressFeedback(state)]}
            >
              <Text style={styles.settingsLabel}>SETTINGS ›</Text>
            </Pressable>
          }
        />

        {/* First run: the figure and chart are both empty, which reads as
            "broken" rather than "new". Say what the button does instead. */}
        {neverTrained && (
          <Text style={styles.firstRunNote}>
            nothing logged yet. tap START SESSION, pick what you&apos;re training, and the app
            prescribes every set from there.
          </Text>
        )}

        <Text style={styles.kicker}>MUSCLE STATUS — {MUSCLE_RECENCY_FADE_DAYS} DAYS</Text>
        <BodyHeatMap
          intensityByGroup={recency}
          scale={2.4}
          legend={['due', 'just trained']}
        />

        <Text style={styles.kicker}>VOLUME — LAST {HOME_CHART_DAYS} DAYS</Text>
        <VolumeChart rows={volumeRows} unit={unitPreference} nowMs={nowMs} />
      </ScrollView>

      {/* Pinned to the thumb zone. One primary; the two ways of looking
          backwards share a row so they read as a pair and never compete
          with START for the eye. */}
      <View style={styles.footer}>
        <Pressable
          testID="start-session"
          onPress={() => router.push('/session')}
          accessibilityRole="button"
          accessibilityLabel={activeSession ? 'Resume session' : 'Start session'}
          style={(state) => [styles.startButton, pressFeedback(state)]}
        >
          <Text style={styles.startLabel}>
            {activeSession ? 'RESUME SESSION' : 'START SESSION'}
          </Text>
        </Pressable>
        <View style={styles.secondaryRow}>
          <Pressable
            testID="open-review"
            onPress={() => router.push('/review')}
            accessibilityRole="button"
            accessibilityLabel="Week review"
            style={(state) => [styles.reviewButton, pressFeedback(state)]}
          >
            <Text style={styles.reviewLabel}>WEEK REVIEW</Text>
          </Pressable>
          <Pressable
            testID="open-history"
            onPress={() => router.push('/history')}
            accessibilityRole="button"
            accessibilityLabel="Workout history"
            style={(state) => [styles.historyButton, pressFeedback(state)]}
          >
            <Text style={styles.historyLabel}>HISTORY</Text>
          </Pressable>
        </View>
      </View>
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
  kicker: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 2,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  settingsButton: {
    minHeight: touchTarget.secondaryMinPt,
    justifyContent: 'center',
    paddingLeft: spacing.md,
  },
  settingsLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 1,
  },
  firstRunNote: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  startButton: {
    minHeight: touchTarget.primaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.schematicCyan,
    borderRadius: 4,
    backgroundColor: palette.surface,
  },
  startLabel: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.display,
    fontSize: fontSize.body,
    letterSpacing: 1,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  // Copper: the palette's progression-indicator accent — review IS progression.
  reviewButton: {
    flex: 1,
    minHeight: touchTarget.secondaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.copper,
    borderRadius: 4,
    backgroundColor: palette.surface,
  },
  reviewLabel: {
    color: palette.copper,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 1,
  },
  historyButton: {
    flex: 1,
    minHeight: touchTarget.secondaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.slate,
    borderRadius: 4,
    backgroundColor: palette.surface,
  },
  historyLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 1,
  },
});
