import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NumberPad } from '@/components/NumberPad';
import { progressionWindowForExercise } from '@/config/progressionConfig';
import { EXERCISE_CATALOG, getExerciseById } from '@/data/exerciseCatalog';
import type { Exercise, SetFeedback } from '@/domain/types';
import { formatLoad, LB_PER_KG, LOAD_STEP_LB, steppedLoadKg, unitSuffix } from '@/domain/units';
import { seedLoadKgForExercise } from '@/engine/seeding';
import { loadStepKgForExercise, useAppStore, type HistoricalEntry } from '@/store/appStore';
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
 * Log a workout that happened before the app saw it — the on-ramp for a
 * lifter with a paper logbook, and the repair path when a session was
 * trained without the phone.
 *
 * A logged lift is a first-class history row: the engine progresses from it
 * exactly as from a tracked one. That is why the feedback tap is required
 * rather than defaulted — feedback is the engine's ONLY input (PRD D5), and
 * a silent "just right" would be the app inventing training data.
 *
 * Entry is by stepper and big-key pad, same as the workout screen. The one
 * <TextInput> filters the exercise list; this is setup, not the active
 * workout flow (same precedent as the custom-exercise builder).
 */

/** A workout older than this is almost certainly a mis-tap on the date. */
const LOG_MAX_DAYS_AGO = 365;

/** Day jumps offered either side of the date. */
const DAY_JUMPS = [-7, -1, 1, 7] as const;

/**
 * Back-dated rows land at local noon: far enough from either midnight that
 * the history screen's local-day grouping cannot slide a lift into the
 * neighbouring day, in any timezone.
 */
const LOG_HOUR_LOCAL = 12;

const FEEDBACK_OPTIONS: { feedback: SetFeedback; label: string }[] = [
  { feedback: 'easy', label: 'FELT EASY' },
  { feedback: 'justRight', label: 'JUST RIGHT' },
  { feedback: 'grind', label: 'GRIND / FORM BROKE' },
];

function dateFromDaysAgo(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(LOG_HOUR_LOCAL, 0, 0, 0);
  return date;
}

function relativeDayLabel(daysAgo: number): string {
  if (daysAgo === 0) return 'TODAY';
  if (daysAgo === 1) return 'YESTERDAY';
  return `${daysAgo} DAYS AGO`;
}

export default function LogPastWorkoutScreen() {
  const unitPreference = useAppStore((state) => state.unitPreference);
  const customExercises = useAppStore((state) => state.customExercises);
  const historyByExercise = useAppStore((state) => state.sessionHistoryByExercise);
  const logPastWorkout = useAppStore((state) => state.logPastWorkout);

  // Defaults to yesterday: today's training is what the live loop is for.
  const [daysAgo, setDaysAgo] = useState(1);
  const [entries, setEntries] = useState<HistoricalEntry[]>([]);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [loadKg, setLoadKg] = useState(0);
  const [reps, setReps] = useState(0);
  const [filter, setFilter] = useState('');
  const [padVisible, setPadVisible] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const workoutDate = dateFromDaysAgo(daysAgo);

  // Every exercise, unfiltered by gym profile: a past workout may have been
  // trained somewhere other than the gym selected today.
  const catalog = [...EXERCISE_CATALOG, ...customExercises];
  const needle = filter.trim().toLowerCase();
  const matches =
    needle === ''
      ? catalog
      : catalog.filter((exercise) => exercise.name.toLowerCase().includes(needle));

  const stepDays = (delta: number) =>
    setDaysAgo((current) => Math.min(LOG_MAX_DAYS_AGO, Math.max(0, current - delta)));

  /**
   * Opening an exercise pre-fills from its last recorded session — the
   * likeliest answer by a wide margin, and it saves a tired thumb 20 taps.
   * Never seen before: the same seed the live loop would use.
   */
  const onPickExercise = (exercise: Exercise) => {
    const history = historyByExercise[exercise.id] ?? [];
    const last = history[history.length - 1];
    const window = progressionWindowForExercise(exercise);
    setSelected(exercise);
    setLoadKg(last?.loadKg ?? seedLoadKgForExercise(exercise));
    setReps(last?.repsAchieved ?? window.repRangeLow);
    setStatus(null);
  };

  const stepLoad = (direction: 1 | -1) => {
    if (!selected) return;
    const stepKg = loadStepKgForExercise(selected.id);
    setLoadKg((current) => round2(steppedLoadKg(current, direction, unitPreference, stepKg)));
  };

  // The feedback tap IS the add: one action, mirroring the Post-Set Matrix.
  const onAddEntry = (feedback: SetFeedback) => {
    if (!selected || reps < 1) return;
    setEntries((current) => [
      ...current,
      { exerciseId: selected.id, loadKg, repsAchieved: reps, feedback },
    ]);
    setSelected(null);
    setFilter('');
  };

  const onRemoveEntry = (index: number) =>
    setEntries((current) => current.filter((_, i) => i !== index));

  const onSave = async () => {
    if (entries.length === 0) return;
    const saved = await logPastWorkout(workoutDate.toISOString(), entries);
    if (!saved) {
      // Rows are in memory but not durable — say so rather than navigating
      // away on a half-written workout.
      setStatus('save failed — history not written to disk, see logs');
      return;
    }
    router.back();
  };

  const displayLoad = (kg: number) => `${formatLoad(kg, unitPreference)} ${unitSuffix(unitPreference)}`;
  // Say what a press is worth: the step differs by unit (2.5 lb grid) and by
  // exercise class in kg.
  const loadStepHint =
    unitPreference === 'lb'
      ? `±${LOAD_STEP_LB} LB`
      : selected
        ? `±${loadStepKgForExercise(selected.id)} KG`
        : '';

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable
          testID="log-back"
          onPress={() => router.back()}
          style={(state) => [styles.backButton, pressFeedback(state)]}
        >
          <Text style={styles.backButtonLabel}>‹ HISTORY</Text>
        </Pressable>

        <Text style={styles.kicker}>LOG PAST WORKOUT</Text>

        <Text style={styles.fieldLabel}>WHEN</Text>
        <Text style={styles.dateValue}>{workoutDate.toDateString().toUpperCase()}</Text>
        <Text style={styles.dateRelative}>{relativeDayLabel(daysAgo)}</Text>
        <View style={styles.dayRow}>
          {DAY_JUMPS.map((jump) => {
            // Dimmed only at the bounds — today is the ceiling (a workout
            // can't be logged in the future); a jump past a bound clamps to it.
            const disabled =
              jump > 0 ? daysAgo === 0 : daysAgo === LOG_MAX_DAYS_AGO;
            return (
              <Pressable
                key={jump}
                testID={`day-${jump}`}
                onPress={() => stepDays(jump)}
                style={(state) => [
                  styles.dayButton,
                  disabled && styles.dayButtonDisabled,
                  pressFeedback(state),
                ]}
              >
                <Text style={[styles.dayLabel, disabled && styles.dayLabelDisabled]}>
                  {jump > 0 ? `+${jump}D` : `${jump}D`}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {entries.length > 0 && (
          <>
            <Text style={styles.fieldLabel}>THIS WORKOUT ({entries.length})</Text>
            {entries.map((entry, index) => (
              <View
                key={`${entry.exerciseId}-${index}`}
                style={[styles.entryRow, { borderLeftColor: feedbackColor[entry.feedback] }]}
              >
                <View style={styles.entryInfo}>
                  <Text style={styles.entryName}>
                    {getExerciseById(entry.exerciseId)?.name ?? entry.exerciseId}
                  </Text>
                  <Text style={styles.entryStats}>
                    {displayLoad(entry.loadKg)} × {entry.repsAchieved}
                  </Text>
                </View>
                <Pressable
                  testID={`remove-entry-${index}`}
                  onPress={() => onRemoveEntry(index)}
                  style={(state) => [styles.removeButton, pressFeedback(state)]}
                >
                  <Text style={styles.removeLabel}>REMOVE</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}

        {selected === null ? (
          <>
            <Text style={styles.fieldLabel}>ADD AN EXERCISE</Text>
            <TextInput
              testID="log-filter"
              value={filter}
              onChangeText={setFilter}
              placeholder="filter by name"
              placeholderTextColor={palette.slate}
              style={styles.filterInput}
              maxLength={40}
              autoCorrect={false}
            />
            {matches.length === 0 && <Text style={styles.note}>no exercise matches that name</Text>}
            {matches.map((exercise) => (
              <Pressable
                key={exercise.id}
                testID={`pick-${exercise.id}`}
                onPress={() => onPickExercise(exercise)}
                style={(state) => [styles.pickRow, pressFeedback(state)]}
              >
                <Text style={styles.pickName}>{exercise.name}</Text>
                <Text style={styles.pickMuscles}>{exercise.primaryMuscles.join(' · ')}</Text>
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <View style={styles.selectedHeader}>
              <Text style={styles.selectedName}>{selected.name.toUpperCase()}</Text>
              <Pressable
                testID="change-exercise"
                onPress={() => setSelected(null)}
                style={(state) => [styles.removeButton, pressFeedback(state)]}
              >
                <Text style={styles.removeLabel}>CHANGE</Text>
              </Pressable>
            </View>

            {/* Tap the numeral to type it — big-key pad, never the system keyboard. */}
            <Pressable
              testID="log-edit-load"
              onPress={() => setPadVisible(true)}
              style={pressFeedback}
            >
              <Text style={styles.loadValue}>
                {formatLoad(loadKg, unitPreference)}
                <Text style={styles.loadUnit}> {unitSuffix(unitPreference)}</Text>
              </Text>
            </Pressable>
            <Text style={styles.repsValue}>× {reps}</Text>

            <StepperRow
              label="LOAD"
              hint={loadStepHint}
              onMinus={() => stepLoad(-1)}
              onPlus={() => stepLoad(1)}
            />
            <StepperRow
              label="REPS"
              onMinus={() => setReps((current) => Math.max(1, current - 1))}
              onPlus={() => setReps((current) => current + 1)}
            />

            <Text style={styles.fieldLabel}>HOW DID THAT GO? — TAP TO ADD</Text>
            <View style={styles.buttonStack}>
              {FEEDBACK_OPTIONS.map(({ feedback, label }) => (
                <Pressable
                  key={feedback}
                  testID={`log-feedback-${feedback}`}
                  onPress={() => onAddEntry(feedback)}
                  style={(state) => [
                    styles.bigButton,
                    { borderColor: feedbackColor[feedback] },
                    pressFeedback(state),
                  ]}
                >
                  <Text style={[styles.bigButtonLabel, { color: feedbackColor[feedback] }]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.note}>
              worst set of the exercise — it is what the engine progresses from
            </Text>
          </>
        )}

        {status && <Text style={styles.hazardNote}>{status}</Text>}
      </ScrollView>

      {/* Pinned to the thumb zone; only exists once there is something to save. */}
      {entries.length > 0 && (
        <View style={styles.footer}>
          <Pressable
            testID="log-save"
            onPress={() => void onSave()}
            style={(state) => [styles.saveButton, pressFeedback(state)]}
          >
            <Text style={styles.saveLabel}>
              SAVE {entries.length} {entries.length === 1 ? 'LIFT' : 'LIFTS'}
            </Text>
          </Pressable>
        </View>
      )}

      <NumberPad
        visible={padVisible}
        label="LOAD"
        unit={unitSuffix(unitPreference)}
        allowDecimal
        onCancel={() => setPadVisible(false)}
        onSubmit={(value) => {
          // Pad speaks display units; storage is always kg.
          setLoadKg(round2(Math.max(0, unitPreference === 'lb' ? value / LB_PER_KG : value)));
          setPadVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

/** Kill 0.1+0.2 artifacts before they reach the display or history. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
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
  return (
    <View style={styles.stepperRow}>
      <Pressable
        testID={`log-stepper-${label}-minus`}
        onPress={onMinus}
        style={(state) => [styles.stepperButton, pressFeedback(state)]}
      >
        <Text style={styles.stepperGlyph}>−</Text>
      </Pressable>
      <View style={styles.stepperLabelBlock}>
        <Text style={styles.stepperLabel}>{label}</Text>
        {hint && <Text style={styles.stepperHint}>{hint}</Text>}
      </View>
      <Pressable
        testID={`log-stepper-${label}-plus`}
        onPress={onPlus}
        style={(state) => [styles.stepperButton, pressFeedback(state)]}
      >
        <Text style={styles.stepperGlyph}>+</Text>
      </Pressable>
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
  fieldLabel: {
    color: palette.copper,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  dateValue: {
    color: palette.textPrimary,
    fontFamily: fontFamily.monoBold,
    fontSize: fontSize.heading,
  },
  dateRelative: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: 2,
  },
  dayRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dayButton: {
    flex: 1,
    minHeight: touchTarget.secondaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.schematicCyan,
    borderRadius: 4,
    backgroundColor: palette.surface,
  },
  dayButtonDisabled: {
    borderColor: palette.surface,
  },
  dayLabel: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 1,
  },
  dayLabelDisabled: {
    color: palette.slate,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  entryInfo: {
    flex: 1,
  },
  entryName: {
    color: palette.textPrimary,
    fontFamily: fontFamily.displayRegular,
    fontSize: fontSize.body,
  },
  entryStats: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: 2,
  },
  removeButton: {
    minHeight: touchTarget.secondaryMinPt,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  removeLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.caption,
    letterSpacing: 1,
  },
  filterInput: {
    minHeight: touchTarget.secondaryMinPt,
    borderWidth: 1,
    borderColor: palette.slate,
    borderRadius: 4,
    backgroundColor: palette.surface,
    color: palette.textPrimary,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.body,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  pickRow: {
    minHeight: touchTarget.primaryMinPt,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.surface,
    paddingVertical: spacing.sm,
  },
  pickName: {
    color: palette.textPrimary,
    fontFamily: fontFamily.displayRegular,
    fontSize: fontSize.body,
  },
  pickMuscles: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: 2,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  selectedName: {
    color: palette.textPrimary,
    fontFamily: fontFamily.display,
    fontSize: fontSize.heading,
    letterSpacing: 1,
    flexShrink: 1,
  },
  loadValue: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.monoBold,
    fontSize: fontSize.numeralHero,
    textAlign: 'center',
    marginTop: spacing.md,
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
    textAlign: 'center',
    marginBottom: spacing.md,
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
  buttonStack: {
    gap: spacing.sm,
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
  note: {
    color: palette.copper,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: spacing.sm,
  },
  // Hazard is semantic: the workout is not on disk.
  hazardNote: {
    color: palette.hazard,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  saveButton: {
    minHeight: touchTarget.primaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.schematicCyan,
    borderRadius: 4,
    backgroundColor: palette.surface,
  },
  saveLabel: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.display,
    fontSize: fontSize.body,
    letterSpacing: 1,
  },
});
