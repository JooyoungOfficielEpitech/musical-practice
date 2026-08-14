/**
 * Lightweight toast shown after a session is recorded.
 * Displays: "Practiced 12m — 84% accuracy" (accuracy line optional).
 * Presentational only; auto-dismiss handled by parent integrator.
 */

import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";

interface SessionCompleteToastProps {
  durationSec: number;
  accuracy?: number;
}

/**
 * Format seconds to human-readable duration (e.g., "12m", "1h 20m")
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function SessionCompleteToast({ durationSec, accuracy }: SessionCompleteToastProps) {
  const { colors } = useTheme();

  const durationStr = formatDuration(durationSec);
  const accuracyStr = accuracy !== undefined ? `${Math.round(accuracy * 100)}%` : null;

  return (
    <View
      style={[styles.toast, { backgroundColor: colors.success }, Shadows.md]}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="checkmark-circle-outline" size={20} color={colors.buttonText} />
      <View style={styles.content}>
        <Text style={[styles.mainText, { color: colors.buttonText }]}>
          Practiced {durationStr}
        </Text>
        {accuracyStr && (
          <Text style={[styles.accuracyText, { color: colors.buttonText }]}>
            {accuracyStr} accuracy
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    gap: Spacing.md,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  mainText: {
    ...Typography.body,
    fontWeight: "600",
  },
  accuracyText: {
    ...Typography.small,
  },
});
