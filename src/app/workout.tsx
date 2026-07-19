import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getExerciseById } from '@/data/exerciseCatalog';
import type { SetFeedback } from '@/domain/types';
import { formatLoad, unitSuffix } from '@/domain/units';
import { loadStepKgForExercise, useAppStore } from '@/store/appStore';

/** How the Post-Set Matrix words map back when replaying history. */
const FEEDBACK_LABELS: Record<SetFeedback, string> = {
  easy: 'FELT EASY',
  justRight: 'JUST RIGHT',
  grind: 'GRIND',
};
import { fontFamily, fontSize, palette, spacing, touchTarget } from '@/theme/tokens';

/**
 * The matrix renders where COMPLETE AS SUGGESTED just was, so an accidental
 * double-tap would register a phantom feedback (worst case: GRIND, which
 * sits exactly under the thumb). Ignore matrix taps briefly after the
 * phase switch.
 */
const MATRIX_ARM_DELAY_MS = 300;

/**
 * Active workout — the core loop (PRD §2). Two phases per set:
 *   working  → steppers + one big COMPLETE AS SUGGESTED
 *   feedback → the 3-button Post-Set Matrix replaces it (sole engine input)
 * Zero-precision by construction: steppers only, primary actions ≥64pt in the
 * lower two-thirds, numerals in mono at glance size. The rationale line keeps
 * the algorithm's reasoning on screen at all times (Exposed Mechanism).
 */
export default function WorkoutScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const active = useAppStore((state) => state.activeExercise);
  const unitPreference = useAppStore((state) => state.unitPreference);
  const startExercise = useAppStore((state) => state.startExercise);
  const adjustLoad = useAppStore((state) => state.adjustLoad);
  const adjustReps = useAppStore((state) => state.adjustReps);
  const adjustSets = useAppStore((state) => state.adjustSets);
  const completeSet = useAppStore((state) => state.completeSet);
  const abandonExercise = useAppStore((state) => state.abandonExercise);

  const [awaitingFeedback, setAwaitingFeedback] = useState(false);
  const matrixArmedAtMs = useRef(0);
  const exercise = exerciseId ? getExerciseById(exerciseId) : undefined;
  const history = useAppStore((state) =>
    exerciseId ? state.sessionHistoryByExercise[exerciseId] : undefined,
  );
  // Where the prescription came from — the previous outing of this movement.
  const lastResult = history?.[history.length - 1];

  useEffect(() => {
    if (exercise && (!active || active.exerciseId !== exercise.id)) {
      startExercise(exercise.id);
    }
  }, [exercise, active, startExercise]);

  if (!exercise) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.rationale}>Unknown exercise — go back and pick again.</Text>
      </SafeAreaView>
    );
  }

  if (!active || active.exerciseId !== exercise.id) {
    return <SafeAreaView style={styles.screen} />; // one frame while startExercise runs
  }

  const setNumber = active.setFeedbacks.length + 1;
  const stepKg = loadStepKgForExercise(exercise.id);
  const isLastSet = setNumber === active.totalSets;

  const onCompleteSet = () => {
    matrixArmedAtMs.current = Date.now() + MATRIX_ARM_DELAY_MS;
    setAwaitingFeedback(true);
  };

  const onFeedback = (feedback: SetFeedback) => {
    if (Date.now() < matrixArmedAtMs.current) {
      return; // phantom tap from the phase switch — see MATRIX_ARM_DELAY_MS
    }
    setAwaitingFeedback(false);
    completeSet(feedback); // clears activeExercise on the final set
    if (isLastSet) {
      router.back();
    }
  };

  const onCancel = () => {
    // Nothing recorded for this exercise: completed sets of PREVIOUS
    // exercises are safe; only the in-flight prescription is discarded.
    abandonExercise();
    router.back();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Pressable testID="cancel-exercise" onPress={onCancel} style={styles.cancelButton}>
        <Text style={styles.cancelLabel}>‹ CANCEL EXERCISE</Text>
      </Pressable>
      <View style={styles.header}>
        <Text style={styles.exerciseName}>{exercise.name.toUpperCase()}</Text>
        <Text style={styles.setCounter}>
          SET {setNumber}/{active.totalSets}
        </Text>
      </View>

      <View style={styles.prescription}>
        <Text style={styles.loadValue}>
          {formatLoad(active.loadKg, unitPreference)}
          <Text style={styles.loadUnit}> {unitSuffix(unitPreference)}</Text>
        </Text>
        <Text style={styles.repsValue}>× {active.targetReps}</Text>
        <Text style={styles.rationale}>{active.rationale}</Text>
        {lastResult && (
          <Text style={styles.lastTime}>
            LAST TIME {formatLoad(lastResult.loadKg, unitPreference)}{' '}
            {unitSuffix(unitPreference)} × {lastResult.repsAchieved} ·{' '}
            {FEEDBACK_LABELS[lastResult.feedback]}
          </Text>
        )}
      </View>

      <View style={styles.controls}>
        {awaitingFeedback ? (
          <>
            <Text style={styles.prompt}>HOW WAS THAT SET?</Text>
            <View style={styles.buttonStack}>
              <BigButton
                label="FELT EASY"
                color={palette.schematicCyan}
                onPress={() => onFeedback('easy')}
              />
              <BigButton
                label="JUST RIGHT"
                color={palette.copper}
                onPress={() => onFeedback('justRight')}
              />
              <BigButton
                label="GRIND / FORM BROKE"
                color={palette.hazard}
                onPress={() => onFeedback('grind')}
              />
            </View>
          </>
        ) : (
          <>
            <StepperRow
              label="LOAD"
              onMinus={() => adjustLoad(-stepKg)}
              onPlus={() => adjustLoad(stepKg)}
            />
            <StepperRow label="REPS" onMinus={() => adjustReps(-1)} onPlus={() => adjustReps(1)} />
            <StepperRow label="SETS" onMinus={() => adjustSets(-1)} onPlus={() => adjustSets(1)} />
            <View style={styles.buttonStack}>
              <BigButton
                label="COMPLETE AS SUGGESTED"
                color={palette.schematicCyan}
                onPress={onCompleteSet}
              />
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function StepperRow({
  label,
  onMinus,
  onPlus,
}: {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.stepperRow}>
      <Pressable testID={`stepper-${label}-minus`} onPress={onMinus} style={styles.stepperButton}>
        <Text style={styles.stepperGlyph}>−</Text>
      </Pressable>
      <Text style={styles.stepperLabel}>{label}</Text>
      <Pressable testID={`stepper-${label}-plus`} onPress={onPlus} style={styles.stepperButton}>
        <Text style={styles.stepperGlyph}>+</Text>
      </Pressable>
    </View>
  );
}

function BigButton({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={`button-${label}`}
      onPress={onPress}
      style={[styles.bigButton, { borderColor: color }]}
    >
      <Text style={[styles.bigButtonLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.gunmetal,
    paddingHorizontal: spacing.md,
  },
  cancelButton: {
    minHeight: touchTarget.secondaryMinPt,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingRight: spacing.md,
  },
  cancelLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.xs,
  },
  exerciseName: {
    color: palette.textPrimary,
    fontFamily: fontFamily.display,
    fontSize: fontSize.heading,
    letterSpacing: 1,
    flexShrink: 1,
  },
  setCounter: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.label,
    marginLeft: spacing.sm,
  },
  prescription: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  loadValue: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.monoBold,
    fontSize: fontSize.numeralHero,
  },
  loadUnit: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.heading,
  },
  repsValue: {
    color: palette.textPrimary,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.numeralLarge,
    marginTop: spacing.xs,
  },
  rationale: {
    color: palette.copper,
    fontFamily: fontFamily.displayRegular,
    fontSize: fontSize.label,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  lastTime: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  // Everything interactive sits below here — lower two-thirds, one thumb.
  controls: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: spacing.lg,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  stepperButton: {
    width: touchTarget.primaryMinPt,
    height: touchTarget.primaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.slate,
    borderRadius: 4,
    backgroundColor: palette.surface,
  },
  stepperGlyph: {
    color: palette.textPrimary,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.numeralLarge,
  },
  stepperLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 2,
  },
  prompt: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  buttonStack: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  bigButton: {
    minHeight: touchTarget.primaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 4,
    backgroundColor: palette.surface,
  },
  bigButtonLabel: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.body,
    letterSpacing: 1,
  },
});
