import React, { useRef, useCallback } from "react";
import { StyleSheet, Text, View, Pressable, Modal, Alert, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ShareCard } from "@/components/ShareCard";
import { generateShareText } from "@/lib/shareCard";
import { shouldRequestReview, requestStoreReview } from "@/lib/reviewPrompt";
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
  streak?: number;
  totalSessions?: number;
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

export function SessionCompleteModal({ visible, result, onClose, streak = 0, totalSessions = 0 }: SessionCompleteModalProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const cardMaxWidth = width >= 768 ? 480 : 320;
  const shareCardRef = useRef<View>(null);

  const handleShare = useCallback(async () => {
    if (!result) return;
    try {
      const { isAvailableAsync, shareAsync } = await import("expo-sharing");
      const available = await isAvailableAsync();
      if (!available) {
        Alert.alert("Sharing is not available on this device");
        return;
      }
      // Fallback: share text only (view-shot requires additional package)
      const text = generateShareText({
        accuracy: result.accuracy,
        duration: result.duration,
        streak,
      });
      await shareAsync("data:text/plain," + encodeURIComponent(text), {
        dialogTitle: "Share your practice result",
      });
    } catch {
      // Share cancelled or failed — silently ignore
    }
  }, [result, streak]);

  // Trigger review request when modal becomes visible with a good result
  React.useEffect(() => {
    if (visible && result && result.accuracy >= 70) {
      shouldRequestReview(totalSessions, result.accuracy).then((should) => {
        if (should) requestStoreReview();
      });
    }
  }, [visible, result, totalSessions]);

  if (!result) return null;

  const scoreColor = getScoreColor(result.accuracy, colors);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.surface, maxWidth: cardMaxWidth }]}>
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
            onPress={handleShare}
            accessibilityLabel="Share practice result"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.shareBtn,
              { backgroundColor: colors.backgroundTertiary, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Ionicons name="share-outline" size={18} color={colors.primary} />
            <Text style={[styles.shareBtnText, { color: colors.primary }]}>Share Result</Text>
          </Pressable>

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
  shareBtn: {
    flexDirection: "row",
    width: "100%",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    minHeight: 48,
    marginBottom: Spacing.sm,
  },
  shareBtnText: {
    ...Typography.subtitle,
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
