import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, Fonts, ClayShadow } from "@/constants/theme";

interface PitchStripProps {
  currentPitch: { note: string; octave: number; cents: number } | null;
  isListening: boolean;
  accuracy?: number;
}

const STRIP_HEIGHT = 44;

function getTuning(cents: number): { label: string; colorKey: "success" | "warning" | "error" } {
  const abs = Math.abs(cents);
  if (abs <= 10) return { label: "In Tune", colorKey: "success" };
  return cents > 0
    ? { label: "Sharp", colorKey: "error" }
    : { label: "Flat", colorKey: "error" };
}

function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  return `${rounded > 0 ? "+" : ""}${rounded}¢`;
}

export const PitchStrip = memo(function PitchStrip({
  currentPitch,
  isListening,
  accuracy = 0,
}: PitchStripProps) {
  const { colors } = useTheme();

  const hasPitch = isListening && currentPitch !== null;
  const tuning = hasPitch ? getTuning(currentPitch.cents) : null;
  const tuningColor = tuning ? colors[tuning.colorKey] : colors.textSecondary;

  return (
    <View
      testID="pitch-strip"
      style={[styles.container, ClayShadow, { backgroundColor: colors.surface }]}
    >
      {/* Note display */}
      <View style={styles.noteSection}>
        <Text style={[styles.noteText, { color: hasPitch ? colors.text : colors.textSecondary }]}>
          {hasPitch ? `${currentPitch.note}${currentPitch.octave}` : "--"}
        </Text>
      </View>

      {hasPitch && (
        <>
          {/* Tuning status */}
          <View style={[styles.tuningBadge, { backgroundColor: `${tuningColor}18` }]}>
            <Text style={[styles.tuningText, { color: tuningColor }]}>
              {tuning!.label}
            </Text>
          </View>

          {/* Cents value */}
          <Text style={[styles.centsText, { color: tuningColor }]}>
            {formatCents(currentPitch.cents)}
          </Text>

          {/* Accuracy */}
          <Text style={[styles.accuracyText, { color: colors.primary }]}>
            {Math.round(accuracy)}%
          </Text>
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: STRIP_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderRadius: 32,
    marginHorizontal: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  noteSection: {
    minWidth: 36,
    alignItems: "center",
  },
  noteText: {
    fontSize: 16,
    fontFamily: Fonts.heading,
    fontWeight: "400",
  },
  tuningBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tuningText: {
    ...Typography.label,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: "600",
  },
  centsText: {
    ...Typography.small,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: "600",
  },
  accuracyText: {
    ...Typography.label,
    fontFamily: Fonts.bodyBold,
    fontWeight: "700",
    marginLeft: "auto",
  },
});
