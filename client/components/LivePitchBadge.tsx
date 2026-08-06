import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Fonts, Typography } from "@/constants/theme";
import type { PitchResult } from "@/lib/audio/types";

export interface LivePitchBadgeProps {
  /** Latest judged reading; null hides the badge (nothing detected yet). */
  pitch: (PitchResult & { correct: boolean }) | null;
  accuracyPercent: number;
}

/**
 * Live singing feedback: detected note, cents offset, and running accuracy.
 * Green while on pitch, red while off.
 */
export function LivePitchBadge({ pitch, accuracyPercent }: LivePitchBadgeProps): React.JSX.Element | null {
  const { colors } = useTheme();

  if (!pitch) return null;

  const centsDisplay = pitch.cents > 0 ? `+${pitch.cents}¢` : `${pitch.cents}¢`;
  const accentColor = pitch.correct ? colors.success : colors.error;

  return (
    <View
      testID="pitch-badge"
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Singing ${pitch.note}${pitch.octave}, ${pitch.correct ? "on pitch" : "off pitch"}, accuracy ${accuracyPercent} percent`}
      style={[styles.badge, { backgroundColor: accentColor }]}
    >
      <Text style={[styles.noteText, { color: colors.buttonText }]} allowFontScaling={false}>
        {pitch.note}
        {pitch.octave}
      </Text>
      <Text style={[styles.centsText, { color: colors.buttonText }]}>{centsDisplay}</Text>
      <View style={styles.accuracyContainer}>
        <Text style={[styles.accuracyText, { color: colors.buttonText }]}>{accuracyPercent}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  noteText: { fontSize: 16, fontFamily: Fonts.bodySemiBold, fontWeight: "600", minWidth: 36 },
  centsText: { ...Typography.small, minWidth: 40, fontVariant: ["tabular-nums"] },
  accuracyContainer: { marginLeft: "auto", paddingLeft: Spacing.sm },
  accuracyText: {
    ...Typography.small, fontFamily: Fonts.bodySemiBold, fontWeight: "600",
    minWidth: 32, textAlign: "right", fontVariant: ["tabular-nums"],
  },
});
