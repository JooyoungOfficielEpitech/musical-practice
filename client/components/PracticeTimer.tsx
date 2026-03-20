import React from "react";
import { StyleSheet, Text, View, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";
import { useTimer } from "@/hooks/useTimer";
import { Spacing } from "@/constants/theme";

interface PracticeTimerProps {
  onTimeUpdate?: (seconds: number) => void;
  onStop?: (totalSeconds: number) => void;
  /** Return false to abort start (e.g. permission denied) */
  onStart?: () => Promise<boolean> | boolean | void;
}

export function PracticeTimer({ onTimeUpdate, onStop, onStart }: PracticeTimerProps) {
  const { colors } = useTheme();
  const { seconds, isRunning, start, pause, formatTime } = useTimer({ onTimeUpdate });

  const toggle = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (!isRunning) {
      if (onStart) {
        const result = await onStart();
        if (result === false) return;
      }
      start();
    } else {
      pause();
    }
  };

  const handleStop = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    pause();
    onStop?.(seconds);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.time, { color: colors.text }]}>{formatTime(seconds)}</Text>
      <View style={styles.controls}>
        <Pressable
          onPress={toggle}
          accessibilityLabel={isRunning ? "Pause practice" : "Start practice"}
          accessibilityRole="button"
          android_ripple={{ color: colors.rippleLight }}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: isRunning ? colors.warning : colors.primaryDark,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
        >
          <Ionicons name={isRunning ? "pause" : "play"} size={20} color={colors.buttonText} />
        </Pressable>
        {seconds > 0 && (
          <Pressable
            onPress={handleStop}
            accessibilityLabel="Stop practice"
            accessibilityRole="button"
            android_ripple={{ color: colors.rippleLight }}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: colors.error,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
          >
            <Ionicons name="stop" size={20} color={colors.buttonText} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: Spacing.sm + 6 },
  time: { fontSize: 48, fontFamily: "Nunito_700Bold", fontWeight: "700", letterSpacing: 2 },
  controls: { flexDirection: "row", gap: Spacing.md },
  btn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
