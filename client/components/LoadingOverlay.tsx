import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { ProgressTrack } from "./ProgressTrack";

interface LoadingOverlayProps {
  message: string;
  subMessage?: string;
  progress?: number;
}

export function LoadingOverlay({
  message,
  subMessage,
  progress,
}: LoadingOverlayProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <ActivityIndicator
        testID="loading-overlay-spinner"
        size="large"
        color={colors.primary}
      />
      <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
      {subMessage !== undefined && (
        <Text
          testID="loading-overlay-submessage"
          style={[styles.subMessage, { color: colors.textSecondary }]}
        >
          {subMessage}
        </Text>
      )}
      {progress !== undefined && (
        <View style={styles.progressWrap}>
          <ProgressTrack percent={progress} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  message: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  subMessage: {
    fontSize: 13,
    textAlign: "center",
  },
  progressWrap: {
    width: "100%",
    marginTop: 8,
  },
});
