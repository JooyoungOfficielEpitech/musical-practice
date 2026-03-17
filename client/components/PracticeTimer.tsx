import React, { useState, useRef, useEffect } from "react";
import { StyleSheet, Text, View, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface PracticeTimerProps {
  onTimeUpdate?: (seconds: number) => void;
  onStop?: (totalSeconds: number) => void;
  onStart?: () => void;
}

export function PracticeTimer({ onTimeUpdate, onStop, onStart }: PracticeTimerProps) {
  const { colors } = useTheme();
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          const next = prev + 1;
          onTimeUpdate?.(next);
          return next;
        });
      }, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [isRunning, onTimeUpdate]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const toggle = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (!isRunning) {
      onStart?.();
    }
    setIsRunning(!isRunning);
  };

  const handleStop = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setIsRunning(false);
    onStop?.(seconds);
    setSeconds(0);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.time, { color: colors.text }]}>{formatTime(seconds)}</Text>
      <View style={styles.controls}>
        <Pressable
          onPress={toggle}
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
