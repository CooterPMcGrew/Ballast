import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyHeatMap } from '@/components/BodyHeatMap';
import { VolumeChart } from '@/components/VolumeChart';
import { HOME_CHART_DAYS } from '@/config/progressionConfig';
import { getExerciseById } from '@/data/exerciseCatalog';
import { muscleRecency, type TimestampedLift } from '@/engine/recency';
import type { VolumeRow } from '@/engine/history';
import { useAppStore } from '@/store/appStore';
import { fontFamily, fontSize, palette, spacing, touchTarget } from '@/theme/tokens';

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

  // Recency input: every timestamped lift whose exercise still exists
  // (renamed/deleted catalog ids drop out rather than crashing Home).
  const lifts: TimestampedLift[] = Object.entries(historyByExercise).flatMap(([id, rows]) => {
    const exercise = getExerciseById(id);
    return exercise
      ? rows.map((row) => ({ exercise, completedAtIso: row.completedAtIso }))
      : [];
  });
  const recency = muscleRecency(lifts, Date.now());
  const volumeRows: VolumeRow[] = Object.values(historyByExercise).flat();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <Text style={styles.kicker}>MUSCLE STATUS — 7 DAYS</Text>
          <Pressable
            testID="open-settings"
            onPress={() => router.push('/settings')}
            style={styles.settingsButton}
          >
            <Text style={styles.settingsLabel}>SETTINGS ›</Text>
          </Pressable>
        </View>

        <BodyHeatMap intensityByGroup={recency} scale={2.4} />

        <Text style={styles.kicker}>VOLUME — LAST {HOME_CHART_DAYS} DAYS</Text>
        <VolumeChart rows={volumeRows} unit={unitPreference} />
      </ScrollView>

      {/* Pinned to the thumb zone — the one action Home offers. */}
      <View style={styles.footer}>
        <Pressable
          testID="start-session"
          onPress={() => router.push('/session')}
          style={styles.startButton}
        >
          <Text style={styles.startLabel}>
            {activeSession ? 'RESUME SESSION' : 'START SESSION'}
          </Text>
        </Pressable>
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
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
});
