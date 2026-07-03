import React from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface LoadingSkeletonProps {
  height?: number;
}

export function LoadingSkeleton({ height = 200 }: LoadingSkeletonProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary, height }]}>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.lg,
  },
});
