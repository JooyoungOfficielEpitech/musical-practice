import React, { useState, useRef, useEffect } from "react";
import { StyleSheet, Text, View, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

interface PracticeTimerProps {
  onTimeUpdate?: (seconds: number) => void;
  onStop?: (totalSeconds: number) => void;
}

export function PracticeTimer({ onTimeUpdate, onStop }: PracticeTimerProps) {
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
      <Text style={styles.time}>{formatTime(seconds)}</Text>
      <View style={styles.controls}>
        <Pressable
          onPress={toggle}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: isRunning ? Colors.light.warning : Colors.light.primaryDark,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
        >
          <Ionicons
            name={isRunning ? "pause" : "play"}
            size={20}
            color={Colors.light.primaryText}
          />
        </Pressable>
        {seconds > 0 && (
          <Pressable
            onPress={handleStop}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: Colors.light.error,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
          >
            <Ionicons name="stop" size={20} color={Colors.light.primaryText} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 14,
  },
  time: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    letterSpacing: 2,
  },
  controls: {
    flexDirection: "row",
    gap: 12,
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
