import React, { useMemo } from "react";
import { StyleSheet, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Fonts, Typography } from "@/constants/theme";
import type { PartInfo } from "@/types/music";

export interface PartsSummaryBarProps {
  parts: PartInfo[];
  visiblePartIds: Set<string>;
  onPress: () => void;
}

/** Builds a short label like "All 5 parts" or "Soprano +2". */
function summarize(parts: PartInfo[], visibleIds: Set<string>): string {
  const visible = parts.filter((p) => visibleIds.has(p.id));
  if (visible.length === parts.length) {
    return parts.length === 1 ? parts[0].name : `All ${parts.length} parts`;
  }
  if (visible.length === 0) return "No parts selected";
  if (visible.length === 1) return visible[0].name;
  return `${visible[0].name} +${visible.length - 1}`;
}

/**
 * Compact pre-practice parts row. Shows which voices are selected and opens the
 * full part-check sheet on tap — keeps the detected-parts info one tap away
 * without stacking a tall card above the score.
 */
function PartsSummaryBarComponent({
  parts,
  visiblePartIds,
  onPress,
}: PartsSummaryBarProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const label = useMemo(() => summarize(parts, visiblePartIds), [parts, visiblePartIds]);
  if (parts.length === 0) return null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Parts: ${label}. Tap to choose parts.`}
      style={({ pressed }) => [
        styles.bar,
        { backgroundColor: colors.surface, borderColor: colors.borderLight, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Ionicons name="people-outline" size={16} color={colors.primary} />
      <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.action, { color: colors.primary }]}>Choose</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

export const PartsSummaryBar = React.memo(PartsSummaryBarComponent);

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minHeight: 44,
  },
  label: { ...Typography.label, flex: 1, fontFamily: Fonts.bodySemiBold },
  action: { ...Typography.small, fontFamily: Fonts.bodySemiBold },
});
