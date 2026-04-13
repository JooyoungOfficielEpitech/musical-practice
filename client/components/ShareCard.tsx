import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { getScoreEmoji } from "@/lib/shareCard";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface ShareCardProps {
  accuracy: number;
  duration: number; // seconds
  streak: number;
  bpm: number;
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs}s`;
}

function getScoreColor(accuracy: number, colors: Record<string, string>): string {
  if (accuracy >= 80) return colors.success;
  if (accuracy >= 60) return colors.warning;
  return colors.error;
}

export function ShareCard({ accuracy, duration, streak, bpm }: ShareCardProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const emoji = getScoreEmoji(accuracy);
  const scoreColor = getScoreColor(accuracy, colors);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, width: isTablet ? 400 : 300 }]}>
      <View style={styles.header}>
        <Ionicons name="mic" size={20} color={colors.primary} />
        <Text style={[styles.appName, { color: colors.primary }]}>Musical Practice</Text>
      </View>

      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.accuracy, { color: scoreColor }]}>{accuracy}%</Text>
      <Text style={[styles.accuracyLabel, { color: colors.textSecondary }]}>Pitch Accuracy</Text>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.statValue, { color: colors.text }]}>{formatDuration(duration)}</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
        <View style={styles.statItem}>
          <Ionicons name="flame-outline" size={16} color={colors.warning} />
          <Text style={[styles.statValue, { color: colors.text }]}>{streak}d streak</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
        <View style={styles.statItem}>
          <Ionicons name="musical-note-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.statValue, { color: colors.text }]}>{bpm} BPM</Text>
        </View>
      </View>

      <Text style={[styles.watermark, { color: colors.textSecondary }]}>
        musicalpractice.app
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  appName: {
    ...Typography.subtitle,
  },
  emoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  accuracy: {
    fontSize: 56,
    fontFamily: "Nunito_700Bold",
    fontWeight: "700",
    lineHeight: 64,
  },
  accuracyLabel: {
    ...Typography.body,
    marginBottom: Spacing.xl,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  statValue: {
    ...Typography.small,
    fontFamily: "Nunito_600SemiBold",
    fontWeight: "600",
  },
  statDivider: {
    width: 1,
    height: 16,
  },
  watermark: {
    ...Typography.label,
    opacity: 0.6,
  },
});
