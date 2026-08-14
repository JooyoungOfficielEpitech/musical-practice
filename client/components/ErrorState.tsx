import React from "react";
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { hapticFeedback } from "@/lib/hapticFeedback";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface ErrorStateProps {
  title: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  /** Disables the retry button and shows a spinner so slow retries can't be double-tapped. */
  retrying?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function ErrorState({
  title,
  message,
  retryLabel = "Try Again",
  onRetry,
  retrying = false,
  icon = "alert-circle-outline",
}: ErrorStateProps) {
  const { colors } = useTheme();

  const handleRetryPress = () => {
    void hapticFeedback.triggerMedium();
    onRetry?.();
  };

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={colors.error} />
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      {onRetry && (
        <Pressable
          onPress={handleRetryPress}
          disabled={retrying}
          accessibilityLabel={retryLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: retrying, busy: retrying }}
          android_ripple={{ color: colors.rippleLight }}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.primary,
              opacity: retrying ? 0.6 : pressed ? 0.9 : 1,
              transform: [{ scale: pressed && !retrying ? 0.98 : 1 }],
            },
          ]}
        >
          {retrying && <ActivityIndicator size="small" color={colors.buttonText} />}
          <Text style={[styles.buttonText, { color: colors.buttonText }]}>
            {retrying ? "Retrying…" : retryLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing["5xl"], gap: Spacing.md, alignItems: "center" },
  title: { ...Typography.subtitle, textAlign: "center" },
  message: { ...Typography.body, textAlign: "center" },
  button: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  buttonText: { ...Typography.subtitle },
});
