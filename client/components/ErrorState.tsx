import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { hapticFeedback } from "@/lib/hapticFeedback";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface ErrorStateProps {
  title: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function ErrorState({
  title,
  message,
  retryLabel = "Try Again",
  onRetry,
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
          accessibilityLabel={retryLabel}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.buttonText }]}>{retryLabel}</Text>
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
  },
  buttonText: { ...Typography.subtitle },
});
