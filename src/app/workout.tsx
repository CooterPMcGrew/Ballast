import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NumberPad } from '@/components/NumberPad';
import { ScreenHeader } from '@/components/ScreenHeader';
import { buzzRestOver, buzzSetDone, buzzVerdict } from '@/platform/haptics';
import { restSecForExercise } from '@/config/progressionConfig';
import { getExerciseById } from '@/data/exerciseCatalog';
import type { SetFeedback } from '@/domain/types';
import { formatLoad, LB_PER_KG, LOAD_STEP_LB, unitSuffix } from '@/domain/units';
import { loadStepKgForExercise, useAppStore } from '@/store/appStore';
import {
  feedbackColor,
  fontFamily,
  fontSize,
  motion,
  palette,
  pressFeedback,
  spacing,
  touchTarget,
} from '@/theme/tokens';

/** How the Post-Set Matrix words map back when replaying history. */
const FEEDBACK_LABELS: Record<SetFeedback, string> = {
  easy: 'FELT EASY',
  justRight: 'JUST RIGHT',
  grind: 'GRIND',
};

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
  const stepLoad = useAppStore((state) => state.stepLoad);
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
  // Armed only once sets are on the board — see onLeave.
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const restEndsAtMs = useRef(0);
  const matrixArmedAtMs = useRef(0);
  // Once the user has left, this mount must never start another exercise.
  // router.back() does not unmount the screen — the pop is animated, so the
  // intent effect below gets at least one more run with activeExercise now
  // null and would rebuild the prescription that was just discarded. Same
  // failure and same guard as sessionEnded in session.tsx.
  const leftExercise = useRef(false);
  // Drains 1 → 0 over the rest period on the UI thread, so the bar flows at
  // display rate instead of stepping once per REST_TICK_MS.
  const restProgress = useSharedValue(0);
  const restBarStyle = useAnimatedStyle(() => ({ width: `${restProgress.value * 100}%` }));
  const exercise = exerciseId ? getExerciseById(exerciseId) : undefined;
  const history = useAppStore((state) =>
    exerciseId ? state.sessionHistoryByExercise[exerciseId] : undefined,
  );
  // Where the prescription came from — the previous outing of this movement.
  const lastResult = history?.[history.length - 1];
  const setsOnTheBoard = active?.setFeedbacks.length ?? 0;

  /**
   * Leaving mid-exercise. An exercise only folds into history on its FINAL
   * set, so walking away after 2 of 3 sets means the engine learns nothing
   * from them — a silent loss the user cannot see coming from a "‹" glyph.
   * Nothing completed: leave immediately, there is nothing to warn about.
   * Sets completed: one confirming tap, the same SURE? idiom the delete
   * controls use elsewhere.
   */
  const onLeave = useCallback(() => {
    if (setsOnTheBoard > 0 && !confirmingLeave) {
      setConfirmingLeave(true);
      return;
    }
    leftExercise.current = true;
    abandonExercise();
    router.back();
  }, [setsOnTheBoard, confirmingLeave, abandonExercise]);

  // Android hardware back must obey the same contract as the on-screen
  // control; without this it pops the route straight past the warning.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onLeave();
      return true; // handled — never let the default pop run
    });
    return () => subscription.remove();
  }, [onLeave]);

  useEffect(() => {
    if (!exercise || leftExercise.current) return;
    if (!active || active.exerciseId !== exercise.id) {
      // The URL is the user's intent: navigating to a different exercise
      // SWITCHES to it (in-flight prescription discarded, same contract as
      // CANCEL; completed sets stay in the session log). The old "snap the
      // URL back" behavior silently mislogged sets under the previous
      // exercise. Superset swaps never hit this branch — their handlers
      // sync the param explicitly before this effect runs.
      startExercise(exercise.id);
    }
  }, [exercise, active, startExercise]);

  // Rest countdown against wall time — a background tab or slow frame can't
  // stretch the rest period.
  useEffect(() => {
    if (phase !== 'resting') return;
    const tick = setInterval(() => {
      const left = Math.ceil((restEndsAtMs.current - Date.now()) / 1000);
      if (left <= 0) {
        buzzRestOver(); // the phone taps you on the shoulder: back to work
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
        <ScreenHeader
          title="UNKNOWN EXERCISE"
          back={{ label: 'EXERCISES', onPress: () => router.back() }}
        />
        <Text style={styles.rationale}>
          That exercise is no longer in the catalog — go back and pick again.
        </Text>
      </SafeAreaView>
    );
  }

  if (!active || active.exerciseId !== exercise.id) {
    return <SafeAreaView style={styles.screen} />; // one frame while startExercise runs
  }

  const setNumber = active.setFeedbacks.length + 1;
  const isLastSet = setNumber === active.totalSets;
  // Say what a press is worth — the step differs by unit (2.5 lb grid) and by
  // exercise class in kg, so the button can't be left to guesswork.
  const loadStepHint =
    unitPreference === 'lb'
      ? `±${LOAD_STEP_LB} LB`
      : `±${loadStepKgForExercise(exercise.id)} KG`;

  const onCompleteSet = () => {
    buzzSetDone();
    matrixArmedAtMs.current = Date.now() + MATRIX_ARM_DELAY_MS;
    setPhase('feedback');
  };

  const startRest = () => {
    const restSec = restSecForExercise(exercise);
    restEndsAtMs.current = Date.now() + restSec * 1000;
    setRestRemainingSec(restSec);
    // Full, then drain linearly for exactly the rest period.
    restProgress.value = 1;
    restProgress.value = withTiming(0, {
      duration: restSec * 1000,
      easing: Easing.linear,
    });
    setPhase('resting');
  };

  const onSkipRest = () => {
    restProgress.value = 0;
    setPhase('working');
  };

  const onFeedback = (feedback: SetFeedback) => {
    if (Date.now() < matrixArmedAtMs.current) {
      return; // phantom tap from the phase switch — see MATRIX_ARM_DELAY_MS
    }
    buzzVerdict();
    const finishedLeg = active.supersetOrder;
    completeSet(feedback); // on the final set: folds, partner takes over
    const nextActive = useAppStore.getState().activeExercise;

    if (isLastSet) {
      if (!nextActive) {
        router.back();
        return;
      }
      // Superset hand-off: sync the URL in the same tick so the intent
      // effect sees param === active and never mistakes this for a switch.
      router.setParams({ exerciseId: nextActive.exerciseId });
      setPhase('working');
      return;
    }

    const partner = useAppStore.getState().pausedExercise;
    if (partner) {
      // Superset: alternate immediately; rest only after the second leg,
      // so the rest period covers the PAIR, not each half.
      swapSupersetPartner();
      router.setParams({ exerciseId: partner.exerciseId });
      if (finishedLeg === 1) {
        startRest();
      } else {
        setPhase('working');
      }
      return;
    }

    startRest();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title={exercise.name.toUpperCase()}
        back={{ label: 'EXERCISES', onPress: onLeave }}
        right={
          <Text style={styles.setCounter} accessibilityLabel={`Set ${setNumber} of ${active.totalSets}`}>
            SET {setNumber}/{active.totalSets}
          </Text>
        }
      />

      {/* Hazard is semantic here: sets are about to stop counting. */}
      {confirmingLeave && (
        <Animated.View entering={FadeIn.duration(motion.phaseSwapMs)} style={styles.confirmBar}>
          <Text style={styles.confirmText}>
            {setsOnTheBoard} SET{setsOnTheBoard === 1 ? '' : 'S'} DONE — LEAVING NOW DROPS THEM
            FROM PROGRESSION.
          </Text>
          <View style={styles.confirmActions}>
            <Pressable
              testID="confirm-stay"
              onPress={() => setConfirmingLeave(false)}
              accessibilityRole="button"
              accessibilityLabel="Keep going with this exercise"
              style={(state) => [styles.confirmStay, pressFeedback(state)]}
            >
              <Text style={styles.confirmStayLabel}>KEEP GOING</Text>
            </Pressable>
            <Pressable
              testID="confirm-leave"
              onPress={onLeave}
              accessibilityRole="button"
              accessibilityLabel="Discard this exercise and go back"
              style={(state) => [styles.confirmLeave, pressFeedback(state)]}
            >
              <Text style={styles.confirmLeaveLabel}>DISCARD</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {active.supersetOrder !== undefined && (
        <Text style={styles.supersetTag}>
          SUPERSET {active.supersetOrder === 0 ? 'A' : 'B'}
          {pausedExercise
            ? ` — WITH ${getExerciseById(pausedExercise.exerciseId)?.name.toUpperCase() ?? '?'}`
            : ''}
        </Text>
      )}

      <View style={styles.prescription}>
        {/* Tap a numeral to type it — big-key pad, never the system keyboard.
            The dashed rule and the hint below exist because a bare numeral
            gives no sign it is a control; without them the pad is a feature
            only its author knows about. */}
        <Pressable
          testID="edit-load"
          onPress={() => setPadTarget('load')}
          accessibilityRole="button"
          accessibilityLabel={`Load ${formatLoad(active.loadKg, unitPreference)} ${unitSuffix(unitPreference)}. Tap to type a new load.`}
          style={(state) => [styles.editable, pressFeedback(state)]}
        >
          <Text style={styles.loadValue}>
            {formatLoad(active.loadKg, unitPreference)}
            <Text style={styles.loadUnit}> {unitSuffix(unitPreference)}</Text>
          </Text>
        </Pressable>
        <Pressable
          testID="edit-reps"
          onPress={() => setPadTarget('reps')}
          accessibilityRole="button"
          accessibilityLabel={`Target ${active.targetReps} reps. Tap to type a new rep count.`}
          style={(state) => [styles.editable, pressFeedback(state)]}
        >
          <Text style={styles.repsValue}>× {active.targetReps}</Text>
        </Pressable>
        <Text style={styles.editHint}>TAP A NUMBER TO TYPE IT</Text>

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
                accessibilityLabel={`Set ${index + 1}: ${FEEDBACK_LABELS[feedback]}`}
                style={[styles.setBlock, { backgroundColor: feedbackColor[feedback] }]}
              />
            ))}
            <Pressable
              testID="undo-set"
              onPress={undoLastSet}
              accessibilityRole="button"
              accessibilityLabel="Undo the last completed set"
              style={(state) => [styles.undoButton, pressFeedback(state)]}
            >
              <Text style={styles.undoLabel}>UNDO SET</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Keyed on phase so each swap fades in rather than snapping — the
          controls change meaning here, and an instant swap reads as a
          misfire when a button appears under a thumb already moving. */}
      <View style={styles.controls}>
        <Animated.View key={phase} entering={FadeIn.duration(motion.phaseSwapMs)}>
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
              <Text
                style={styles.restCountdown}
                accessibilityRole="timer"
                accessibilityLiveRegion="polite"
                accessibilityLabel={`Rest, ${restRemainingSec} seconds remaining`}
              >
                {formatCountdown(restRemainingSec)}
              </Text>
              {/* Draining bar: rest as a visible quantity, not just digits. */}
              <View style={styles.restTrack}>
                <Animated.View style={[styles.restFill, restBarStyle]} />
              </View>
              <View style={styles.buttonStack}>
                <BigButton label="SKIP REST" color={palette.slate} onPress={onSkipRest} />
              </View>
            </>
          ) : (
            <>
              <StepperRow
                label="LOAD"
                hint={loadStepHint}
                onMinus={() => stepLoad(-1)}
                onPlus={() => stepLoad(1)}
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
        </Animated.View>
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
  hint,
  onMinus,
  onPlus,
}: {
  label: string;
  /** What one press is worth, e.g. "±2.5 LB". Optional. */
  hint?: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const spoken = label.toLowerCase();
  return (
    <View style={styles.stepperRow}>
      <Pressable
        testID={`stepper-${label}-minus`}
        onPress={onMinus}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${spoken}${hint ? ` by ${hint.replace('±', '')}` : ''}`}
        style={(state) => [styles.stepperButton, pressFeedback(state)]}
      >
        <Text style={styles.stepperGlyph}>−</Text>
      </Pressable>
      <View style={styles.stepperLabelBlock}>
        <Text style={styles.stepperLabel}>{label}</Text>
        {hint && <Text style={styles.stepperHint}>{hint}</Text>}
      </View>
      <Pressable
        testID={`stepper-${label}-plus`}
        onPress={onPlus}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${spoken}${hint ? ` by ${hint.replace('±', '')}` : ''}`}
        style={(state) => [styles.stepperButton, pressFeedback(state)]}
      >
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
      accessibilityRole="button"
      accessibilityLabel={label}
      style={(state) => [styles.bigButton, { borderColor: color }, pressFeedback(state)]}
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
  setCounter: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.label,
    marginLeft: spacing.sm,
  },
  confirmBar: {
    borderWidth: 1,
    borderColor: palette.hazard,
    borderRadius: 4,
    backgroundColor: palette.surface,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  confirmText: {
    color: palette.hazard,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    lineHeight: 17,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  // Staying is the safe default, so it carries the cyan primary weight.
  confirmStay: {
    flex: 2,
    minHeight: touchTarget.secondaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.schematicCyan,
    borderRadius: 4,
  },
  confirmStayLabel: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 1,
  },
  confirmLeave: {
    flex: 1,
    minHeight: touchTarget.secondaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.hazard,
    borderRadius: 4,
  },
  confirmLeaveLabel: {
    color: palette.hazard,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 1,
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
    marginTop: spacing.lg,
  },
  // A rule under a tappable numeral — the only affordance separating a
  // control from a readout on this screen. Solid, not dashed: RN falls back
  // to solid anyway unless every border width matches, so a dashed
  // declaration would render differently per platform for no gain.
  editable: {
    borderBottomWidth: 1,
    borderBottomColor: '#8FA0AE66',
    paddingHorizontal: spacing.sm,
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
  editHint: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    letterSpacing: 1,
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
  stepperLabelBlock: {
    alignItems: 'center',
  },
  stepperLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 2,
  },
  stepperHint: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
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
  restTrack: {
    height: 4,
    backgroundColor: palette.surface,
    borderRadius: 2,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  restFill: {
    height: 4,
    backgroundColor: palette.schematicCyan,
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
