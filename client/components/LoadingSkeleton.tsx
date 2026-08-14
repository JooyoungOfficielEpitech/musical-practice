import React from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface LoadingSkeletonProps {
  height?: number;
  /** What is loading — shown under the spinner so waits are never unexplained. */
  label?: string;
}

export function LoadingSkeleton({ height = 200, label }: LoadingSkeletonProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: colors.backgroundSecondary, height }]}
      accessible={!!label}
      accessibilityLabel={label}
      accessibilityLiveRegion={label ? "polite" : "none"}
    >
      <ActivityIndicator size="small" color={colors.primary} />
      {!!label && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.lg,
  },
  label: { ...Typography.small, textAlign: "center" },
});
