/**
 * Compact horizontal stats strip for top of Library list.
 * Shows: flame icon + streak, clock + total time, music icon + session count.
 * Hides entirely when no sessions recorded (totalSessions === 0).
 */

import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";
import type { UserStats } from "@/lib/storage";

interface LibraryStatsStripProps {
  stats: UserStats;
}

/**
 * Format seconds to human-readable duration (e.g., "3h 20m")
 */
function formatDuration(seconds: number): string {
  if (seconds === 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function LibraryStatsStrip({ stats }: LibraryStatsStripProps) {
  const { colors } = useTheme();

  // Hide entirely when no sessions
  if (stats.totalSessions === 0) {
    return null;
  }

  return (
    <View style={[styles.strip, { backgroundColor: colors.surface }, Shadows.sm]}>
      {/* Streak */}
      <View style={styles.stat}>
        <Ionicons name="flame" size={18} color={colors.warning} />
        <Text style={[styles.statValue, { color: colors.text }]}>{stats.streak}</Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>day streak</Text>
      </View>

      {/* Total Practice Time */}
      <View style={styles.divider} />
      <View style={styles.stat}>
        <Ionicons name="time-outline" size={18} color={colors.primary} />
        <Text style={[styles.statValue, { color: colors.text }]}>
          {formatDuration(stats.totalPracticeTime)}
        </Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>practiced</Text>
      </View>

      {/* Session Count */}
      <View style={styles.divider} />
      <View style={styles.stat}>
        <Ionicons name="musical-notes-outline" size={18} color={colors.accent} />
        <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalSessions}</Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>sessions</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  statValue: {
    ...Typography.title,
  },
  statLabel: {
    ...Typography.small,
    textAlign: "center",
  },
  divider: {
    width: 1,
    height: 50,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    marginHorizontal: Spacing.md,
  },
});
