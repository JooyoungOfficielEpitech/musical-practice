import React from "react";
import { StyleSheet, Text, View, Pressable, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface SessionResult {
  duration: number; // total seconds
  accuracy: number;
  bpm: number;
  recordingSaved?: boolean;
}

interface SessionCompleteModalProps {
  visible: boolean;
  result: SessionResult | null;
  onClose: () => void;
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

export function SessionCompleteModal({ visible, result, onClose }: SessionCompleteModalProps) {
  const { colors } = useTheme();

  if (!result) return null;

  const scoreColor = getScoreColor(result.accuracy, colors);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.warningSubtle }]}>
            <Ionicons name="trophy" size={32} color={colors.warning} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>Session Complete</Text>

          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: colors.backgroundTertiary }]}>
              <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatDuration(result.duration)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Duration</Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: colors.backgroundTertiary }]}>
              <Ionicons name="analytics-outline" size={18} color={scoreColor} />
              <Text style={[styles.statValue, { color: scoreColor }]}>
                {result.accuracy}%
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Accuracy</Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: colors.backgroundTertiary }]}>
              <Ionicons name="musical-note-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {result.bpm}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>BPM</Text>
            </View>
          </View>

          {result.recordingSaved && (
            <View style={[styles.recordingBadge, { backgroundColor: colors.successLight }]}>
              <Ionicons name="mic" size={14} color={colors.success} />
              <Text style={[styles.recordingText, { color: colors.success }]}>Recording saved</Text>
            </View>
          )}

          <Pressable
            onPress={onClose}
            accessibilityLabel="Close session summary"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.closeBtn,
              { backgroundColor: colors.primaryDark, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={[styles.closeBtnText, { color: colors.buttonText }]}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing["3xl"],
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: "center",
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.title,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  statsGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
    width: "100%",
    marginBottom: Spacing.lg,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    gap: Spacing.xs,
  },
  statValue: {
    ...Typography.subtitle,
    fontFamily: "Nunito_700Bold",
    fontWeight: "700",
  },
  statLabel: {
    ...Typography.label,
  },
  recordingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.lg,
  },
  recordingText: {
    ...Typography.small,
    fontFamily: "Nunito_500Medium",
    fontWeight: "500",
  },
  closeBtn: {
    width: "100%",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    minHeight: 48,
  },
  closeBtnText: {
    ...Typography.subtitle,
  },
});
