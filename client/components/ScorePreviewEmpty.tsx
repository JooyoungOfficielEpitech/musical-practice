import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, Fonts, Shadows } from "@/constants/theme";

export function ScorePreviewEmpty(): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View style={[styles.browseSection, { marginTop: Spacing.md }]}>
      <View style={[styles.emptyStateContainer, { backgroundColor: colors.surface }, Shadows.sm]}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.textSecondary} />
        <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No score preview</Text>
        <Text style={[styles.emptyStateMessage, { color: colors.textSecondary }]}>Scan sheet music to enable auto-play</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  browseSection: { paddingHorizontal: Spacing.lg },
  emptyStateContainer: {
    flexDirection: "column",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  emptyStateTitle: {
    ...Typography.subtitle,
    fontFamily: Fonts.heading,
    fontSize: 18,
  },
  emptyStateMessage: Typography.body,
});
