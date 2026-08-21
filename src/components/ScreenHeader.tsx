import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  fontFamily,
  fontSize,
  palette,
  pressFeedback,
  spacing,
  touchTarget,
} from '@/theme/tokens';

/**
 * The one header every screen wears. Before this, six screens each rolled
 * their own back control with its own label grammar and its own copy of the
 * same StyleSheet block — so the escape hatch sat in a slightly different
 * place, at a slightly different size, on every screen. A user who cannot
 * aim learns exactly one gesture here: the top-left control always goes
 * back, and it always says where it lands.
 *
 * The back label names the DESTINATION ("‹ HOME"), not the action ("‹ Back").
 * Telling the user where they will end up is what lets them navigate an
 * unfamiliar screen without trying it first.
 */
interface ScreenHeaderProps {
  /** Screen name, upper-cased by the caller's copy. Always shown. */
  title: string;
  /** Omit on a root screen (Home) — nothing to go back to. */
  back?: {
    /** Where the user lands, e.g. "HOME". Rendered as "‹ HOME". */
    label: string;
    onPress: () => void;
  };
  /** Optional trailing control (Home's SETTINGS link). */
  right?: ReactNode;
  /** One line under the title: what this screen is for, when not obvious. */
  subtitle?: string;
}

export function ScreenHeader({ title, back, right, subtitle }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        {back ? (
          <Pressable
            testID="screen-back"
            onPress={back.onPress}
            accessibilityRole="button"
            accessibilityLabel={`Back to ${back.label.toLowerCase()}`}
            style={(state) => [styles.backButton, pressFeedback(state)]}
          >
            <Text style={styles.backLabel}>‹ {back.label}</Text>
          </Pressable>
        ) : (
          <View style={styles.backSpacer} />
        )}
        {right}
      </View>

      <Text
        accessibilityRole="header"
        style={styles.title}
      >
        {title}
      </Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTarget.secondaryMinPt,
    marginTop: spacing.xs,
  },
  // 48pt secondary floor, hugging the left edge where a thumb expects it.
  backButton: {
    minHeight: touchTarget.secondaryMinPt,
    justifyContent: 'center',
    paddingRight: spacing.md,
  },
  backLabel: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 1,
  },
  // Holds the row's height on a root screen so the title never shifts
  // vertically between screens — a moving title reads as a page reload.
  backSpacer: {
    minHeight: touchTarget.secondaryMinPt,
  },
  title: {
    color: palette.textPrimary,
    fontFamily: fontFamily.display,
    fontSize: fontSize.heading,
    letterSpacing: 2,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: palette.slate,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    marginTop: spacing.xs,
  },
});
