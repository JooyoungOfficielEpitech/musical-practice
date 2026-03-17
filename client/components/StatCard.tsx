import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color?: string;
}

export function StatCard({ icon, label, value, color }: StatCardProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.primary;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, Shadows.md]}>
      <View style={[styles.iconWrap, { backgroundColor: iconColor + "18" }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm + 6,
    alignItems: "center",
    gap: 6,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  value: { ...Typography.title },
  label: { ...Typography.label, textAlign: "center" },
});
