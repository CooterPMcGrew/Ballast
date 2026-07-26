import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyHeatMap } from '@/components/BodyHeatMap';
import { MuscleMap } from '@/components/MuscleMap';
import { DEFAULT_GYM_PROFILES } from '@/data/defaultGymProfiles';
import { EXERCISE_CATALOG, getExerciseById } from '@/data/exerciseCatalog';
import { CUSTOM_GYM_PROFILE_ID, SPLIT_PRESETS } from '@/domain/types';
import { filterAvailableExercises } from '@/domain/equipment';
import {
  COMPONENT_LABELS,
  MUSCLE_COMPONENTS_BY_GROUP,
  MUSCLE_GROUPS,
  type Exercise,
  type MuscleGroup,
} from '@/domain/types';
import { formatLoad, unitSuffix } from '@/domain/units';
import {
  accumulateCoverage,
  groupCoverage,
  rankExercisesForSession,
} from '@/engine/recommendation';
import type { TimestampedSessionResult } from '@/persistence/types';
import { getProfileById, useAppStore } from '@/store/appStore';
import {
  feedbackColor,
  fontFamily,
  fontSize,
  palette,
  pressFeedback,
  spacing,
  touchTarget,
} from '@/theme/tokens';

/** Rows glide to their new rank instead of teleporting — the re-ranking
 *  is the product's core mechanic, so the user should SEE it happen. */
const RERANK_TRANSITION = LinearTransition.duration(300);

const MS_PER_DAY = 86_400_000;

/** "LAST 60 KG × 8 · 4D AGO" — the row-level memory of this movement. */
function lastResultLine(
  history: readonly TimestampedSessionResult[] | undefined,
  unit: Parameters<typeof formatLoad>[1],
): string | null {
  const last = history?.[history.length - 1];
  if (!last) return null;
  const days = Math.floor((Date.now() - Date.parse(last.completedAtIso)) / MS_PER_DAY);
  const when = days <= 0 ? 'TODAY' : `${days}D AGO`;
  return `LAST ${formatLoad(last.loadKg, unit)} ${unitSuffix(unit)} × ${last.repsAchieved} · ${when}`;
}

/**
 * Session flow, two modes on one route:
 *   /session                → picker: gym profile + muscle-group focus
 *   /session?muscleGroup=x  → the recommender view for that focus
 * The session itself (clock, completed work) survives focus changes and
 * picker visits; only END SESSION closes it. The coverage strip and
 * per-row rationale keep the algorithm's reasoning on screen at all times
 * (Exposed Mechanism) — never a black-box ordering.
 */
export default function SessionScreen() {
  const { muscleGroup } = useLocalSearchParams<{ muscleGroup: string }>();
  const selectedProfileId = useAppStore((state) => state.selectedGymProfileId);
  const selectGymProfile = useAppStore((state) => state.selectGymProfile);
  const customGym = useAppStore((state) => state.customGym);
  const historyByExercise = useAppStore((state) => state.sessionHistoryByExercise);
  const unitPreference = useAppStore((state) => state.unitPreference);
  const customExercises = useAppStore((state) => state.customExercises);
  const supersetArmed = useAppStore((state) => state.supersetArmed);
  const supersetPendingId = useAppStore((state) => state.supersetPendingId);
  const toggleSupersetArm = useAppStore((state) => state.toggleSupersetArm);
  const pickSupersetExercise = useAppStore((state) => state.pickSupersetExercise);
  const activeSession = useAppStore((state) => state.activeSession);
  const startSession = useAppStore((state) => state.startSession);
  const endSession = useAppStore((state) => state.endSession);

  // Collapsible lists so END SESSION never hides behind 40 rows of catalog.
  // The ranked list starts open (it's the point); the rest starts folded.
  const [showRanked, setShowRanked] = useState(true);
  const [showOffTarget, setShowOffTarget] = useState(false);
  const [showSetLog, setShowSetLog] = useState(false);

  // Focus param: one muscle or a comma-joined preset ("chest,shoulders,triceps").
  const targetGroups = (muscleGroup ?? '')
    .split(',')
    .filter((group): group is MuscleGroup => MUSCLE_GROUPS.includes(group as MuscleGroup));
  const focusKey = targetGroups.join(',');

  // Once END SESSION fires, this mount must never start another session:
  // the auto-start effect below re-runs when activeSession flips to null
  // and — without this guard — resurrects the just-ended session if it
  // wins the race against navigation ("sometimes shows RESUME SESSION").
  const sessionEnded = useRef(false);

  useEffect(() => {
    if (sessionEnded.current) return;
    if (targetGroups.length > 0 && activeSession?.muscleGroups.join(',') !== focusKey) {
      startSession(targetGroups);
    }
    // focusKey stands in for targetGroups — same data, stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, activeSession, startSession]);

  // Preset label when the focus matches one ("PUSH"), else the group list.
  const focusLabel =
    Object.entries(SPLIT_PRESETS).find(([, groups]) => groups.join(',') === focusKey)?.[0] ??
    targetGroups.join(' · ').toUpperCase();

  const onEndSessionShared = () => {
    sessionEnded.current = true;
    endSession();
    // replace, not push: the ended session must not sit on the back stack.
    router.replace('/summary');
  };

  // Armed superset: taps collect the pair instead of navigating.
  const onExercisePress = (exerciseId: string) => {
    if (supersetArmed) {
      if (pickSupersetExercise(exerciseId) === 'started') {
        const firstId = useAppStore.getState().activeExercise?.exerciseId ?? exerciseId;
        router.push({ pathname: '/workout', params: { exerciseId: firstId } });
      }
      return;
    }
    router.push({ pathname: '/workout', params: { exerciseId } });
  };

  if (targetGroups.length === 0) {
    const pickerProfile = getProfileById(selectedProfileId, customGym);
    const profiles = customGym.enabled
      ? [...DEFAULT_GYM_PROFILES, getProfileById(CUSTOM_GYM_PROFILE_ID, customGym)]
      : [...DEFAULT_GYM_PROFILES];
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable
            testID="back-to-home"
            onPress={() => router.back()}
            style={(state) => [styles.backButton, pressFeedback(state)]}
          >
            <Text style={styles.backButtonLabel}>‹ HOME</Text>
          </Pressable>

          <Text style={styles.kicker}>GYM PROFILE</Text>
          <View style={styles.chipRow}>
            {profiles.map((p) => {
              const active = p.id === pickerProfile.id;
              return (
                <Pressable
                  key={p.id}
                  testID={`profile-${p.id}`}
                  onPress={() => selectGymProfile(p.id)}
                  style={(state) => [styles.chip, active && styles.chipActive, pressFeedback(state)]}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                    {p.name.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.kicker}>
            {activeSession ? 'SWITCH FOCUS' : 'WHAT ARE YOU TRAINING?'}
          </Text>
          <View style={styles.chipRow}>
            {Object.entries(SPLIT_PRESETS).map(([name, groups]) => (
              <Pressable
                key={name}
                testID={`split-${name}`}
                onPress={() =>
                  router.replace({
                    pathname: '/session',
                    params: { muscleGroup: groups.join(',') },
                  })
                }
                style={(state) => [styles.chip, pressFeedback(state)]}
              >
                <Text style={styles.chipLabel}>{name}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.kicker}>OR ONE MUSCLE</Text>
          <View style={styles.muscleGrid}>
            {MUSCLE_GROUPS.map((group) => (
              <Pressable
                key={group}
                testID={`train-${group}`}
                onPress={() => router.replace({ pathname: '/session', params: { muscleGroup: group } })}
                style={(state) => [styles.muscleButton, pressFeedback(state)]}
              >
                <MuscleMap group={group} />
                <Text style={styles.muscleButtonLabel}>{group.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>

          {activeSession && (
            <Pressable testID="end-session" onPress={onEndSessionShared} style={(state) => [styles.endButton, pressFeedback(state)]}>
              <Text style={styles.endButtonLabel}>END SESSION</Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const profile = getProfileById(selectedProfileId, customGym);
  const completedExercises = (activeSession?.completedExerciseIds ?? [])
    .map((id) => getExerciseById(id))
    .filter((exercise): exercise is Exercise => exercise !== undefined);
  const coverage = accumulateCoverage(completedExercises);
  const groupPercents = groupCoverage(coverage);
  // Stock + user-built: customs rank exactly like catalog movements.
  const fullCatalog = [...EXERCISE_CATALOG, ...customExercises];
  const ranked = rankExercisesForSession({
    catalog: fullCatalog,
    profile,
    targetGroups,
    completedExercises,
  });

  // The rest of the gym stays one scroll away — the focus ranks the list,
  // it never locks the user in ("mix if you want").
  const rankedIds = new Set(ranked.map((entry) => entry.exercise.id));
  const completedIds = new Set(completedExercises.map((exercise) => exercise.id));
  const offTarget = filterAvailableExercises(fullCatalog, profile).filter(
    (exercise) => !rankedIds.has(exercise.id) && !completedIds.has(exercise.id),
  );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Focus switch, not session exit — completed work and clock survive. */}
        <Pressable
          testID="back-to-groups"
          onPress={() => router.replace('/session')}
          style={(state) => [styles.backButton, pressFeedback(state)]}
        >
          <Text style={styles.backButtonLabel}>‹ MUSCLE GROUPS</Text>
        </Pressable>

        <Text style={styles.kicker}>
          {focusLabel} — {profile.name.toUpperCase()}
        </Text>

        {/* Coverage strip: per-component state, the recommender's working memory. */}
        <View style={styles.coverageRow}>
          {targetGroups.flatMap((group) => MUSCLE_COMPONENTS_BY_GROUP[group]).map((component) => {
            const covered = Math.min(1, coverage[component] ?? 0);
            const worked = covered > 0;
            return (
              <View key={component} style={[styles.coverageChip, worked && styles.coverageChipHit]}>
                <Text style={[styles.coverageLabel, worked && styles.coverageLabelHit]}>
                  {COMPONENT_LABELS[component].toUpperCase()}
                </Text>
                <Text style={[styles.coveragePercent, worked && styles.coverageLabelHit]}>
                  {Math.round(covered * 100)}%
                </Text>
              </View>
            );
          })}
        </View>

        {/* Whole-body view: what today's work has reached, muscle by muscle. */}
        <Text style={styles.sectionTitle}>FULL BODY TODAY</Text>
        <BodyHeatMap intensityByGroup={groupPercents} scale={1.5} />
        <View style={styles.groupPctRow}>
          {MUSCLE_GROUPS.map((group) => {
            const pct = Math.round(Math.min(1, groupPercents[group]) * 100);
            return (
              <Text key={group} style={[styles.groupPct, pct > 0 && styles.groupPctLit]}>
                {group.toUpperCase()} {pct}%
              </Text>
            );
          })}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Pressable
            testID="toggle-ranked"
            onPress={() => setShowRanked((open) => !open)}
            style={(state) => [styles.sectionToggle, pressFeedback(state)]}
          >
            <Text style={styles.sectionTitle}>
              {showRanked ? '▾' : '▸'} UP NEXT ({ranked.length})
            </Text>
          </Pressable>
          <Pressable
            testID="superset-arm"
            onPress={toggleSupersetArm}
            style={(state) => [styles.supersetChip, supersetArmed && styles.supersetChipArmed, pressFeedback(state)]}
          >
            <Text style={[styles.supersetChipLabel, supersetArmed && styles.supersetChipLabelArmed]}>
              {supersetArmed
                ? supersetPendingId
                  ? 'PICK 2ND EXERCISE'
                  : 'PICK 2 EXERCISES'
                : 'SUPERSET'}
            </Text>
          </Pressable>
        </View>
        {showRanked && ranked.length === 0 && (
          <Text style={styles.rationale}>
            Nothing available for this group at this gym — switch profiles on Home.
          </Text>
        )}
        {showRanked && ranked.map(({ exercise, rationale }) => {
          const lastLine = lastResultLine(historyByExercise[exercise.id], unitPreference);
          return (
            <Animated.View key={exercise.id} layout={RERANK_TRANSITION}>
              <Pressable
                testID={`recommend-${exercise.id}`}
                onPress={() => onExercisePress(exercise.id)}
                style={(state) => [
                  styles.row,
                  exercise.id === supersetPendingId && styles.rowPending,
                  pressFeedback(state),
                ]}
              >
                <Text style={styles.rowName}>{exercise.name}</Text>
                <Text style={styles.rowRationale}>{rationale}</Text>
                {lastLine && <Text style={styles.rowLast}>{lastLine}</Text>}
              </Pressable>
            </Animated.View>
          );
        })}

        {offTarget.length > 0 && (
          <>
            <Pressable
              testID="toggle-offtarget"
              onPress={() => setShowOffTarget((open) => !open)}
              style={(state) => [styles.sectionToggle, pressFeedback(state)]}
            >
              <Text style={styles.sectionTitle}>
                {showOffTarget ? '▾' : '▸'} EVERYTHING ELSE ({offTarget.length})
              </Text>
            </Pressable>
            {showOffTarget && offTarget.map((exercise) => {
              const lastLine = lastResultLine(historyByExercise[exercise.id], unitPreference);
              return (
                <Pressable
                  key={exercise.id}
                  testID={`mix-${exercise.id}`}
                  onPress={() => onExercisePress(exercise.id)}
                  style={(state) => [
                    styles.row,
                    exercise.id === supersetPendingId && styles.rowPending,
                    pressFeedback(state),
                  ]}
                >
                  <Text style={styles.rowName}>{exercise.name}</Text>
                  <Text style={styles.rowMuscles}>{exercise.primaryMuscles.join(' · ')}</Text>
                  {lastLine && <Text style={styles.rowLast}>{lastLine}</Text>}
                </Pressable>
              );
            })}
          </>
        )}

        {completedExercises.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>DONE TODAY</Text>
            {completedExercises.map((exercise) => (
              <View key={exercise.id} style={styles.doneRow}>
                <Text style={styles.doneCheck}>✓</Text>
                <Text style={styles.doneName}>{exercise.name}</Text>
              </View>
            ))}
          </>
        )}

        <Pressable testID="end-session" onPress={onEndSessionShared} style={(state) => [styles.endButton, pressFeedback(state)]}>
          <Text style={styles.endButtonLabel}>END SESSION</Text>
        </Pressable>

        {/* Very bottom + folded by default: the record is there when wanted,
            never between the user and END SESSION. */}
        {(activeSession?.setLog.length ?? 0) > 0 && (
          <>
            <Pressable
              testID="toggle-setlog"
              onPress={() => setShowSetLog((open) => !open)}
              style={(state) => [styles.sectionToggle, pressFeedback(state)]}
            >
              <Text style={styles.sectionTitle}>
                {showSetLog ? '▾' : '▸'} SET LOG ({activeSession?.setLog.length})
              </Text>
            </Pressable>
            {showSetLog &&
              activeSession?.setLog.map((entry, index) => (
                <View
                  key={`${entry.completedAtIso}-${index}`}
                  style={[styles.logRow, { borderLeftColor: feedbackColor[entry.feedback] }]}
                >
                  <Text style={styles.logText}>
                    {index + 1}. {getExerciseById(entry.exerciseId)?.name ?? entry.exerciseId} —{' '}
                    {formatLoad(entry.loadKg, unitPreference)} {unitSuffix(unitPreference)} ×{' '}
                    {entry.reps}
                  </Text>
                </View>
              ))}
          </>
        )}
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    minHeight: touchTarget.secondaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.slate,
    borderRadius: 4,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.sm,
  },
  chipActive: {
    borderColor: palette.schematicCyan,
  },
  chipLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 1,
    textAlign: 'center',
  },
  chipLabelActive: {
    color: palette.schematicCyan,
  },
  muscleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // Focus pick is the screen's primary action: 64pt floor, two columns.
  muscleButton: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: touchTarget.primaryMinPt,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: palette.schematicCyan,
    borderRadius: 4,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  muscleButtonLabel: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.display,
    fontSize: fontSize.body,
    letterSpacing: 1,
  },
  coverageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  coverageChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: palette.slate,
    borderRadius: 4,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  coverageChipHit: {
    borderColor: palette.schematicCyan,
  },
  coverageLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 1,
  },
  coverageLabelHit: {
    color: palette.schematicCyan,
  },
  coveragePercent: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
  },
  sectionTitle: {
    color: palette.copper,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 2,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  groupPctRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  groupPct: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
  },
  groupPctLit: {
    color: palette.schematicCyan,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Section titles double as fold toggles — 48pt so a tired thumb can fold
  // 40 rows of catalog out of the way of END SESSION.
  sectionToggle: {
    minHeight: touchTarget.secondaryMinPt,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingRight: spacing.md,
  },
  supersetChip: {
    minHeight: touchTarget.secondaryMinPt,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.slate,
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
  },
  supersetChipArmed: {
    borderColor: palette.schematicCyan,
  },
  supersetChipLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 1,
  },
  supersetChipLabelArmed: {
    color: palette.schematicCyan,
  },
  rowPending: {
    borderLeftWidth: 3,
    borderLeftColor: palette.schematicCyan,
    paddingLeft: spacing.sm,
  },
  // Recommendation rows are the session's primary action: 64pt floor.
  row: {
    minHeight: touchTarget.primaryMinPt,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.surface,
    paddingVertical: spacing.sm,
  },
  rowName: {
    color: palette.textPrimary,
    fontFamily: fontFamily.displayRegular,
    fontSize: fontSize.body,
  },
  rowRationale: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: 2,
  },
  rowMuscles: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: 2,
  },
  rowLast: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: 2,
  },
  // "Stacking blocks": each set is a row whose left edge carries its
  // Post-Set color — the session reads as a stratigraphy of effort.
  logRow: {
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  logText: {
    color: palette.textPrimary,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget.secondaryMinPt,
  },
  doneCheck: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.body,
  },
  doneName: {
    color: palette.slate,
    fontFamily: fontFamily.displayRegular,
    fontSize: fontSize.body,
  },
  endButton: {
    minHeight: touchTarget.secondaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.slate,
    borderRadius: 4,
    backgroundColor: palette.surface,
    marginTop: spacing.lg,
  },
  endButtonLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 1,
  },
  rationale: {
    color: palette.copper,
    fontFamily: fontFamily.displayRegular,
    fontSize: fontSize.label,
    marginTop: spacing.md,
  },
});
