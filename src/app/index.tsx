import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MuscleMap } from '@/components/MuscleMap';
import { DEFAULT_GYM_PROFILES } from '@/data/defaultGymProfiles';
import { EXERCISE_CATALOG } from '@/data/exerciseCatalog';
import { filterAvailableExercises } from '@/domain/equipment';
import { CUSTOM_GYM_PROFILE_ID, MUSCLE_GROUPS, type Exercise } from '@/domain/types';
import { getProfileById, useAppStore } from '@/store/appStore';
import { fontFamily, fontSize, palette, spacing, touchTarget } from '@/theme/tokens';

/**
 * Home = session setup: pick the gym (globally filters the catalog, PRD D6),
 * pick today's muscle group, go. The muscle grid is the screen's primary
 * action — 64pt targets. The full movement pool stays below as the
 * browse-anything fallback.
 */
export default function HomeScreen() {
  const selectedProfileId = useAppStore((state) => state.selectedGymProfileId);
  const selectGymProfile = useAppStore((state) => state.selectGymProfile);
  const customGym = useAppStore((state) => state.customGym);

  const profile = getProfileById(selectedProfileId, customGym);
  // The user-built profile joins the chips only while enabled in Settings.
  const profiles = customGym.enabled
    ? [...DEFAULT_GYM_PROFILES, getProfileById(CUSTOM_GYM_PROFILE_ID, customGym)]
    : [...DEFAULT_GYM_PROFILES];
  const available = filterAvailableExercises(EXERCISE_CATALOG, profile);
  const compounds = available.filter((e) => e.exerciseClass === 'compound');
  const isolations = available.filter((e) => e.exerciseClass === 'isolation');

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <Text style={styles.kicker}>GYM PROFILE</Text>
          <Pressable
            testID="open-settings"
            onPress={() => router.push('/settings')}
            style={styles.settingsButton}
          >
            <Text style={styles.settingsLabel}>SETTINGS ›</Text>
          </Pressable>
        </View>
        <View style={styles.chipRow}>
          {profiles.map((p) => {
            const active = p.id === profile.id;
            return (
              <Pressable
                key={p.id}
                testID={`profile-${p.id}`}
                onPress={() => selectGymProfile(p.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {p.name.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.kicker}>TRAIN TODAY</Text>
        <View style={styles.muscleGrid}>
          {MUSCLE_GROUPS.map((group) => (
            <Pressable
              key={group}
              testID={`train-${group}`}
              onPress={() => router.push({ pathname: '/session', params: { muscleGroup: group } })}
              style={styles.muscleButton}
            >
              <MuscleMap group={group} />
              <Text style={styles.muscleButtonLabel}>{group.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.poolHeader}>
          <Text style={styles.kicker}>MOVEMENT POOL</Text>
          <Text style={styles.poolCount}>
            {available.length}/{EXERCISE_CATALOG.length}
          </Text>
        </View>

        <ExerciseGroup title="COMPOUND" exercises={compounds} />
        <ExerciseGroup title="ISOLATION" exercises={isolations} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ExerciseGroup({ title, exercises }: { title: string; exercises: Exercise[] }) {
  if (exercises.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {exercises.map((exercise) => (
        <Pressable
          key={exercise.id}
          testID={`exercise-${exercise.id}`}
          onPress={() => router.push({ pathname: '/workout', params: { exerciseId: exercise.id } })}
          style={styles.row}
        >
          <Text style={styles.rowName}>{exercise.name}</Text>
          <Text style={styles.rowMuscles}>{exercise.primaryMuscles.join(' · ')}</Text>
        </Pressable>
      ))}
    </View>
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
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
  // Session start is the screen's primary action: 64pt floor, two columns.
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
  poolHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  poolCount: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.label,
  },
  group: {
    marginBottom: spacing.lg,
  },
  groupTitle: {
    color: palette.copper,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  row: {
    minHeight: touchTarget.secondaryMinPt,
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
  rowMuscles: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: 2,
  },
});
