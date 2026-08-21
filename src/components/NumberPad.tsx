import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  fontFamily,
  fontSize,
  palette,
  pressFeedback,
  spacing,
  touchTarget,
} from '@/theme/tokens';

/**
 * Direct numeric entry WITHOUT a system keyboard. CLAUDE.md §2 bans
 * <TextInput> in the workout flow because tiny keys and autocorrect are
 * hostile to chalked, shaking hands — but demo feedback showed steppers
 * alone are slow for big jumps (20 → 100 kg). This pad is the reconciling
 * move: typing, but every key is a 64pt target and the system keyboard
 * never appears.
 */

const MAX_DIGITS = 6;

const KEY_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
] as const;

/** Screen readers announce glyphs badly — say what the key does instead. */
const KEY_SPOKEN: Record<string, string> = {
  '.': 'decimal point',
  '⌫': 'delete last digit',
};

interface NumberPadProps {
  visible: boolean;
  label: string;
  /** Shown after the value, e.g. "KG" — display units, caller converts. */
  unit?: string;
  allowDecimal?: boolean;
  onCancel: () => void;
  onSubmit: (value: number) => void;
}

export function NumberPad({
  visible,
  label,
  unit,
  allowDecimal = true,
  onCancel,
  onSubmit,
}: NumberPadProps) {
  const [entry, setEntry] = useState('');

  // Fresh entry each time the pad opens; stale digits would be a data bug.
  useEffect(() => {
    if (visible) setEntry('');
  }, [visible]);

  const onKey = (key: string) => {
    if (key === '⌫') {
      setEntry((current) => current.slice(0, -1));
      return;
    }
    if (key === '.' && (!allowDecimal || entry.includes('.'))) return;
    if (entry.replace('.', '').length >= MAX_DIGITS) return;
    setEntry((current) => (current === '' && key === '.' ? '0.' : current + key));
  };

  const parsed = Number.parseFloat(entry);
  const submittable = entry !== '' && Number.isFinite(parsed);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {/* Tapping the dimmed area closes the pad. Every other sheet the user
          has met behaves this way; without it the only exit is a CANCEL
          button they have to find. */}
      <Pressable
        style={styles.backdrop}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Close the number pad"
      >
        {/* Swallows presses so a mis-aimed tap on the sheet itself — the
            whole premise of this app — never dismisses the pad. */}
        <Pressable
          style={styles.sheet}
          onPress={() => undefined}
          accessibilityViewIsModal
          accessibilityLabel={`Enter ${label}`}
        >
          <Text style={styles.label}>{label}</Text>
          <Text
            style={styles.entry}
            accessibilityLiveRegion="polite"
            accessibilityLabel={entry === '' ? 'nothing entered' : `${entry} ${unit ?? ''}`}
          >
            {entry === '' ? '—' : entry}
            {unit ? <Text style={styles.entryUnit}> {unit}</Text> : null}
          </Text>

          {KEY_ROWS.map((row) => (
            <View key={row.join()} style={styles.keyRow}>
              {row.map((key) => (
                <Pressable
                  key={key}
                  testID={`pad-${key}`}
                  onPress={() => onKey(key)}
                  accessibilityRole="button"
                  accessibilityLabel={KEY_SPOKEN[key] ?? key}
                  style={(state) => [styles.key, pressFeedback(state)]}
                >
                  <Text style={styles.keyGlyph}>{key}</Text>
                </Pressable>
              ))}
            </View>
          ))}

          <View style={styles.actionRow}>
            <Pressable
              testID="pad-cancel"
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel without changing the value"
              style={(state) => [styles.cancelButton, pressFeedback(state)]}
            >
              <Text style={styles.cancelLabel}>CANCEL</Text>
            </Pressable>
            <Pressable
              testID="pad-set"
              // Guard in the handler, not via `disabled`: RN-web renders
              // disabled as pointer-events:none and can leave it stale
              // after the button becomes enabled.
              onPress={() => submittable && onSubmit(parsed)}
              accessibilityRole="button"
              accessibilityState={{ disabled: !submittable }}
              accessibilityLabel={
                submittable ? `Set ${label} to ${entry} ${unit ?? ''}` : `Set ${label} — type a number first`
              }
              style={(state) => [styles.setButton, !submittable && styles.setButtonDisabled, pressFeedback(state)]}
            >
              <Text style={[styles.setLabel, !submittable && styles.setLabelDisabled]}>SET</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#0B0F14E6',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.slate,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  label: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 2,
    textAlign: 'center',
  },
  entry: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.monoBold,
    fontSize: fontSize.numeralLarge,
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  entryUnit: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.body,
  },
  keyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  key: {
    flex: 1,
    minHeight: touchTarget.primaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.slate,
    borderRadius: 4,
    backgroundColor: palette.gunmetal,
  },
  keyGlyph: {
    color: palette.textPrimary,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.heading,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelButton: {
    flex: 1,
    minHeight: touchTarget.secondaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.slate,
    borderRadius: 4,
  },
  cancelLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 1,
  },
  setButton: {
    flex: 2,
    minHeight: touchTarget.primaryMinPt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.schematicCyan,
    borderRadius: 4,
  },
  setButtonDisabled: {
    borderColor: palette.slate,
  },
  setLabel: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.display,
    fontSize: fontSize.body,
    letterSpacing: 1,
  },
  setLabelDisabled: {
    color: palette.slate,
  },
});
