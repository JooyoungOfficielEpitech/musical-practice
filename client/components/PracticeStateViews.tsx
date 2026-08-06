import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { hapticFeedback } from "@/lib/hapticFeedback";
import { Spacing, BorderRadius, Typography, Fonts } from "@/constants/theme";

export interface PracticeStateViewProps {
  omrStatus?: string;
  smoothProgress: number;
  omrRetrying: boolean;
  onRetry: () => void;
}

/** Non-score states of the practice screen: still scanning, failed, or empty. */
export function PracticeStateView({
  omrStatus, smoothProgress, omrRetrying, onRetry,
}: PracticeStateViewProps): React.JSX.Element {
  const { colors } = useTheme();

  if (omrStatus === "processing") {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="hourglass-outline" size={48} color={colors.primary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {`Recognizing music… ${smoothProgress}%`}
        </Text>
        <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
          This score is still being processed. It updates here automatically — feel free to come back in a few minutes.
        </Text>
      </View>
    );
  }

  if (omrStatus === "failed") {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Recognition failed</Text>
        <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
          This score could not be read. You can retry the scan — or delete it and import the PDF again.
        </Text>
        <Pressable
          onPress={() => {
            void hapticFeedback.triggerMedium();
            onRetry();
          }}
          disabled={omrRetrying}
          accessibilityLabel="Retry scan"
          accessibilityRole="button"
          style={({ pressed }) => [styles.retryBtn, { backgroundColor: colors.primary, opacity: omrRetrying ? 0.5 : pressed ? 0.85 : 1 }]}
        >
          <Ionicons name="refresh" size={18} color={colors.buttonText} />
          <Text style={[styles.retryBtnText, { color: colors.buttonText }]}>
            {omrRetrying ? "Restarting…" : "Retry scan"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.emptyState}>
      <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No score loaded</Text>
      <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
        The score could not be loaded. Try re-importing the PDF.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingTop: Spacing["2xl"] },
  emptyTitle: { ...Typography.h3 },
  emptyMessage: { ...Typography.body, textAlign: "center" },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: Spacing.sm,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md, marginTop: Spacing.sm, minHeight: 44,
  },
  retryBtnText: { ...Typography.body, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
});
