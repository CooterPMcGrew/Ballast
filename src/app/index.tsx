import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fontFamily, fontSize, palette, spacing } from '@/theme/tokens';

/**
 * Home. PRD §1: leads with "Recommended for Today" — never a blank list of
 * muscle groups. Honest placeholder until the recommender exists: it states
 * what is missing rather than faking a prescription (Exposed Mechanism).
 */
export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.kicker}>RECOMMENDED FOR TODAY</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>NO PROGRAM LOADED</Text>
        <Text style={styles.cardBody}>
          Recommendation engine not built yet. Next up: gym profiles, training
          goal, and the progression loop.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.gunmetal,
    paddingHorizontal: spacing.md,
  },
  kicker: {
    color: palette.slate,
    fontFamily: fontFamily.display,
    fontSize: fontSize.label,
    letterSpacing: 2,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.slate,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: {
    color: palette.schematicCyan,
    fontFamily: fontFamily.display,
    fontSize: fontSize.heading,
    letterSpacing: 1,
  },
  cardBody: {
    color: palette.slate,
    fontFamily: fontFamily.displayRegular,
    fontSize: fontSize.body,
    lineHeight: 22,
  },
});
