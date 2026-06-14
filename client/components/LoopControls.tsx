import React, { useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";

export interface LoopControlsProps {
  loopPointA: number | null;
  loopPointB: number | null;
  isLoopActive: boolean;
  positionMs: number;
  durationMs: number;
  onCaptureA: (positionMs: number) => void;
  onCaptureB: (positionMs: number) => void;
  onApply: () => void;
  onClear: () => void;
}

function formatTime(ms: number): string {
  const seconds = ms / 1000;
  return `${seconds.toFixed(2)}s`;
}

export function LoopControls({
  loopPointA,
  loopPointB,
  isLoopActive,
  positionMs,
  durationMs,
  onCaptureA,
  onCaptureB,
  onApply,
  onClear,
}: LoopControlsProps): React.JSX.Element {
  const { colors } = useTheme();

  const handleCaptureA = useCallback(() => {
    onCaptureA(positionMs);
  }, [positionMs, onCaptureA]);

  const handleCaptureB = useCallback(() => {
    onCaptureB(positionMs);
  }, [positionMs, onCaptureB]);

  const handleApply = useCallback(() => {
    if (loopPointA !== null && loopPointB !== null) {
      onApply();
    }
  }, [loopPointA, loopPointB, onApply]);

  const canApply = loopPointA !== null && loopPointB !== null;

  return (
    <View
      style={[styles.container, { backgroundColor: colors.surface }, Shadows.sm]}
    >
      <View style={styles.row}>
        <Pressable
          onPress={handleCaptureA}
          accessibilityLabel="Set loop start"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: loopPointA !== null ? colors.primary : colors.backgroundSecondary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons
            name="play-outline"
            size={16}
            color={loopPointA !== null ? colors.buttonText : colors.text}
          />
          <Text
            style={[
              styles.buttonText,
              { color: loopPointA !== null ? colors.buttonText : colors.text },
            ]}
          >
            A
          </Text>
        </Pressable>

        <Text style={[styles.timeText, { color: colors.textSecondary }]}>
          {loopPointA !== null ? formatTime(loopPointA) : formatTime(positionMs)}
        </Text>

        <Pressable
          onPress={handleCaptureB}
          accessibilityLabel="Set loop end"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: loopPointB !== null ? colors.primary : colors.backgroundSecondary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons
            name="stop-outline"
            size={16}
            color={loopPointB !== null ? colors.buttonText : colors.text}
          />
          <Text
            style={[
              styles.buttonText,
              { color: loopPointB !== null ? colors.buttonText : colors.text },
            ]}
          >
            B
          </Text>
        </Pressable>

        <Text style={[styles.timeText, { color: colors.textSecondary }]}>
          {loopPointB !== null ? formatTime(loopPointB) : formatTime(positionMs)}
        </Text>

        <Pressable
          onPress={handleApply}
          disabled={!canApply}
          accessibilityLabel="toggle loop"
          accessibilityRole="switch"
          accessibilityState={{ checked: isLoopActive }}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: isLoopActive ? colors.primary : colors.backgroundSecondary,
              opacity: pressed && canApply ? 0.8 : !canApply ? 0.5 : 1,
            },
          ]}
        >
          <Ionicons
            name={isLoopActive ? "repeat" : "repeat-outline"}
            size={16}
            color={isLoopActive ? colors.buttonText : colors.text}
          />
        </Pressable>

        <Pressable
          onPress={onClear}
          accessibilityLabel="Clear loop"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.backgroundSecondary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name="close" size={16} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const row = { flexDirection: "row" as const, alignItems: "center" as const };
const medium = { ...Typography.label, fontFamily: "Nunito_500Medium" as const, fontWeight: "500" as const };

const styles = StyleSheet.create({
  container: {
    ...row,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  row: {
    ...row,
    flex: 1,
    gap: Spacing.xs,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    ...medium,
    fontSize: 12,
  },
  timeText: {
    ...medium,
    fontSize: 12,
    minWidth: 50,
  },
});
