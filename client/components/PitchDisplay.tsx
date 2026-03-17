import React, { memo } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { PitchResult } from "@/lib/audio/types";

interface PitchDisplayProps {
  isListening: boolean;
  currentPitch: PitchResult | null;
  accuracy: number;
  onToggle: () => void;
  error?: string | null;
}

export const PitchDisplay = memo(function PitchDisplay({
  isListening,
  currentPitch,
  accuracy,
  onToggle,
  error,
}: PitchDisplayProps) {
  const { colors } = useTheme();

  if (error) {
    return (
      <View style={styles.container}>
        <View style={[styles.errorBadge, { backgroundColor: colors.error + "18" }]}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      </View>
    );
  }

  if (!isListening) {
    return (
      <View style={styles.container}>
        <Pressable
          onPress={onToggle}
          style={({ pressed }) => [
            styles.startButton,
            { backgroundColor: colors.primary + "18", opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="mic-outline" size={32} color={colors.primary} />
          <Text style={[styles.startText, { color: colors.primary }]}>Tap to detect pitch</Text>
        </Pressable>
      </View>
    );
  }

  if (!currentPitch) {
    return (
      <View style={styles.container}>
        <View style={[styles.listeningWrap, { backgroundColor: colors.primary + "0D" }]}>
          <Ionicons name="mic" size={24} color={colors.primary} />
          <Text style={[styles.listeningText, { color: colors.textSecondary }]}>Listening...</Text>
        </View>
      </View>
    );
  }

  const centsAbs = Math.abs(currentPitch.cents);
  const tuningColor =
    centsAbs <= 10 ? colors.success : centsAbs <= 25 ? colors.warning : colors.error;
  const tuningLabel =
    centsAbs <= 10 ? "In Tune" : currentPitch.cents > 0 ? "Sharp" : "Flat";

  return (
    <View style={styles.container}>
      <View style={styles.noteRow}>
        <Text style={[styles.noteName, { color: colors.text }]}>
          {currentPitch.note}
          <Text style={[styles.octave, { color: colors.textSecondary }]}>{currentPitch.octave}</Text>
        </Text>
        <View style={[styles.tuningBadge, { backgroundColor: tuningColor + "18" }]}>
          <Text style={[styles.tuningText, { color: tuningColor }]}>{tuningLabel}</Text>
        </View>
      </View>
      <Text style={[styles.frequency, { color: colors.textSecondary }]}>
        {currentPitch.frequency.toFixed(1)} Hz
      </Text>
      {accuracy > 0 && (
        <View style={[styles.accuracyBadge, { backgroundColor: colors.success + "18" }]}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={[styles.accuracyText, { color: colors.success }]}>
            Accuracy: {accuracy}%
          </Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: Spacing.sm },
  startButton: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing["3xl"],
    borderRadius: BorderRadius.md,
  },
  startText: { ...Typography.body, fontFamily: "Nunito_500Medium", fontWeight: "500" },
  listeningWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.sm,
  },
  listeningText: { ...Typography.body },
  noteRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  noteName: { fontSize: 40, fontFamily: "Nunito_700Bold", fontWeight: "700" },
  octave: { fontSize: 24, fontFamily: "Nunito_400Regular", fontWeight: "400" },
  frequency: { ...Typography.small },
  tuningBadge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  tuningText: { ...Typography.label, fontFamily: "Nunito_600SemiBold", fontWeight: "600" },
  accuracyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.xs,
  },
  accuracyText: { ...Typography.label, fontFamily: "Nunito_600SemiBold", fontWeight: "600" },
  errorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  errorText: { ...Typography.small, flex: 1 },
});
