import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NumberPad } from '@/components/NumberPad';
import { restSecForExercise } from '@/config/progressionConfig';
import { getExerciseById } from '@/data/exerciseCatalog';
import type { SetFeedback } from '@/domain/types';
import { formatLoad, LB_PER_KG, unitSuffix } from '@/domain/units';
import { loadStepKgForExercise, useAppStore } from '@/store/appStore';

/** How the Post-Set Matrix words map back when replaying history. */
const FEEDBACK_LABELS: Record<SetFeedback, string> = {
  easy: 'FELT EASY',
  justRight: 'JUST RIGHT',
  grind: 'GRIND',
};
import {
  feedbackColor,
  fontFamily,
  fontSize,
  palette,
  spacing,
  touchTarget,
} from '@/theme/tokens';

/**
 * The matrix renders where COMPLETE AS SUGGESTED just was, so an accidental
 * double-tap would register a phantom feedback (worst case: GRIND, which
 * sits exactly under the thumb). Ignore matrix taps briefly after the
 * phase switch.
 */
const MATRIX_ARM_DELAY_MS = 300;

/** UI check cadence for the rest countdown; the clock itself is wall time. */
const REST_TICK_MS = 250;

type WorkoutPhase = 'working' | 'feedback' | 'resting';

function formatCountdown(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

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
  const setLoadKg = useAppStore((state) => state.setLoadKg);
  const setTargetReps = useAppStore((state) => state.setTargetReps);
  const adjustSets = useAppStore((state) => state.adjustSets);
  const completeSet = useAppStore((state) => state.completeSet);
  const undoLastSet = useAppStore((state) => state.undoLastSet);
  const abandonExercise = useAppStore((state) => state.abandonExercise);
  const pausedExercise = useAppStore((state) => state.pausedExercise);
  const swapSupersetPartner = useAppStore((state) => state.swapSupersetPartner);

  const [phase, setPhase] = useState<WorkoutPhase>('working');
  const [padTarget, setPadTarget] = useState<'load' | 'reps' | null>(null);
  const [restRemainingSec, setRestRemainingSec] = useState(0);
  const restEndsAtMs = useRef(0);
  const matrixArmedAtMs = useRef(0);
  const exercise = exerciseId ? getExerciseById(exerciseId) : undefined;
  const history = useAppStore((state) =>
    exerciseId ? state.sessionHistoryByExercise[exerciseId] : undefined,
  );
  // Where the prescription came from — the previous outing of this movement.
  const lastResult = history?.[history.length - 1];

  useEffect(() => {
    if (!exercise) return;
    if (!active) {
      startExercise(exercise.id);
    } else if (active.exerciseId !== exercise.id) {
      // The store leads during superset swaps and hand-offs; the URL follows.
      // (Also means navigating to another exercise mid-set can't silently
      // abandon work — CANCEL EXERCISE is the explicit path out.)
      router.setParams({ exerciseId: active.exerciseId });
    }
  }, [exercise, active, startExercise]);

  // Rest countdown against wall time — a background tab or slow frame can't
  // stretch the rest period.
  useEffect(() => {
    if (phase !== 'resting') return;
    const tick = setInterval(() => {
      const left = Math.ceil((restEndsAtMs.current - Date.now()) / 1000);
      if (left <= 0) {
        setPhase('working');
      } else {
        setRestRemainingSec(left);
      }
    }, REST_TICK_MS);
    return () => clearInterval(tick);
  }, [phase]);

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
    setPhase('feedback');
  };

  const startRest = () => {
    const restSec = restSecForExercise(exercise);
    restEndsAtMs.current = Date.now() + restSec * 1000;
    setRestRemainingSec(restSec);
    setPhase('resting');
  };

  const onFeedback = (feedback: SetFeedback) => {
    if (Date.now() < matrixArmedAtMs.current) {
      return; // phantom tap from the phase switch — see MATRIX_ARM_DELAY_MS
    }
    const finishedLeg = active.supersetOrder;
    completeSet(feedback); // on the final set: folds, partner takes over
    const nextActive = useAppStore.getState().activeExercise;

    if (isLastSet) {
      if (!nextActive) {
        router.back();
        return;
      }
      setPhase('working'); // partner continues (URL syncs via the effect)
      return;
    }

    if (useAppStore.getState().pausedExercise) {
      // Superset: alternate immediately; rest only after the second leg,
      // so the rest period covers the PAIR, not each half.
      swapSupersetPartner();
      if (finishedLeg === 1) {
        startRest();
      } else {
        setPhase('working');
      }
      return;
    }

    startRest();
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

      {active.supersetOrder !== undefined && (
        <Text style={styles.supersetTag}>
          SUPERSET {active.supersetOrder === 0 ? 'A' : 'B'}
          {pausedExercise
            ? ` — WITH ${getExerciseById(pausedExercise.exerciseId)?.name.toUpperCase() ?? '?'}`
            : ''}
        </Text>
      )}

      <View style={styles.prescription}>
        {/* Tap a numeral to type it — big-key pad, never the system keyboard. */}
        <Pressable testID="edit-load" onPress={() => setPadTarget('load')}>
          <Text style={styles.loadValue}>
            {formatLoad(active.loadKg, unitPreference)}
            <Text style={styles.loadUnit}> {unitSuffix(unitPreference)}</Text>
          </Text>
        </Pressable>
        <Pressable testID="edit-reps" onPress={() => setPadTarget('reps')}>
          <Text style={styles.repsValue}>× {active.targetReps}</Text>
        </Pressable>
        <Text style={styles.rationale}>{active.rationale}</Text>
        {lastResult && (
          <Text style={styles.lastTime}>
            LAST TIME {formatLoad(lastResult.loadKg, unitPreference)}{' '}
            {unitSuffix(unitPreference)} × {lastResult.repsAchieved} ·{' '}
            {FEEDBACK_LABELS[lastResult.feedback]}
          </Text>
        )}

        {/* Completed sets stack, colored by how each felt; UNDO pops the top. */}
        {active.setFeedbacks.length > 0 && (
          <View style={styles.setStackRow}>
            {active.setFeedbacks.map((feedback, index) => (
              <View
                key={index}
                style={[styles.setBlock, { backgroundColor: feedbackColor[feedback] }]}
              />
            ))}
            <Pressable testID="undo-set" onPress={undoLastSet} style={styles.undoButton}>
              <Text style={styles.undoLabel}>UNDO SET</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        {phase === 'feedback' ? (
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
        ) : phase === 'resting' ? (
          <>
            <Text style={styles.prompt}>REST</Text>
            <Text style={styles.restCountdown}>{formatCountdown(restRemainingSec)}</Text>
            <View style={styles.buttonStack}>
              <BigButton
                label="SKIP REST"
                color={palette.slate}
                onPress={() => setPhase('working')}
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

      <NumberPad
        visible={padTarget !== null}
        label={padTarget === 'load' ? 'LOAD' : 'REPS'}
        unit={padTarget === 'load' ? unitSuffix(unitPreference) : undefined}
        allowDecimal={padTarget === 'load'}
        onCancel={() => setPadTarget(null)}
        onSubmit={(value) => {
          // Explicit per-target branches: a double-fired submit (pad already
          // closed, padTarget null) must be a no-op, never hit the wrong field.
          if (padTarget === 'load') {
            // Pad speaks display units; storage is always kg.
            setLoadKg(unitPreference === 'lb' ? value / LB_PER_KG : value);
          } else if (padTarget === 'reps') {
            setTargetReps(value);
          }
          setPadTarget(null);
        }}
      />
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
  supersetTag: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    letterSpacing: 1,
    marginTop: spacing.xs,
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
  setStackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  setBlock: {
    width: 18,
    height: 18,
    borderRadius: 2,
  },
  undoButton: {
    minHeight: touchTarget.secondaryMinPt,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    marginLeft: spacing.sm,
  },
  undoLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 1,
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
  restCountdown: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.monoBold,
    fontSize: fontSize.numeralLarge,
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
