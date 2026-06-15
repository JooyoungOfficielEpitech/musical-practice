import React, { memo, useState, useEffect, useRef } from "react";
import { StyleSheet, Text, View, Pressable, Platform, ActivityIndicator } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";
import { useTimer } from "@/hooks/useTimer";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";

interface PracticeBottomBarProps {
  /** Return false to abort start (e.g. permission denied, audio init failed) */
  onStart?: () => Promise<boolean> | boolean | void;
  onStop?: (totalSeconds: number) => void;
  onTimeUpdate?: (seconds: number) => void;
  onRunningChange?: (isRunning: boolean) => void;
  minimal?: boolean;
  /** Auto-start timer on mount (used when entering practice mode from browse) */
  autoStart?: boolean;
}

export const PracticeBottomBar = memo(function PracticeBottomBar({
  onStart,
  onStop,
  onTimeUpdate,
  onRunningChange,
  minimal,
  autoStart,
}: PracticeBottomBarProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [isStarting, setIsStarting] = useState(false);
  const { seconds, isRunning, start, pause, stop, formatTime } = useTimer({ onTimeUpdate });
  const didAutoStart = useRef(false);

  useEffect(() => {
    if (autoStart && !didAutoStart.current) {
      didAutoStart.current = true;
      start();
      onRunningChange?.(true);
    }
  }, [autoStart, start, onRunningChange]);

  const toggle = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (!isRunning) {
      if (onStart) {
        setIsStarting(true);
        try {
          if (__DEV__) console.log("[BottomBar] calling onStart...");
          const result = await onStart();
          if (__DEV__) console.log("[BottomBar] onStart returned:", result);
          if (result === false) {
            if (__DEV__) console.log("[BottomBar] onStart returned false — aborting");
            setIsStarting(false);
            return;
          }
        } catch (e) {
          if (__DEV__) console.error("[BottomBar] onStart threw:", e);
          setIsStarting(false);
          return;
        }
        setIsStarting(false);
      }
      if (__DEV__) console.log("[BottomBar] starting timer + isPracticing=true");
      start();
      onRunningChange?.(true);
    } else {
      pause();
      onRunningChange?.(false);
    }
  };

  const handleStop = () => {
    if (__DEV__) console.log("[BottomBar] handleStop, seconds:", seconds);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    const elapsed = seconds; // capture before reset
    stop(); // pause + reset seconds to 0
    onRunningChange?.(false);
    onStop?.(elapsed);
  };

  const content = (
    <View
      style={[
        styles.container,
        minimal && styles.containerMinimal,
        !minimal && {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderLight,
        },
        { paddingBottom: Math.max(insets.bottom, Spacing.sm) },
      ]}
    >
      {/* Timer */}
      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Session timer, currently at ${formatTime(seconds)}`}
      >
        <Text style={[styles.timer, { color: colors.text }]}>
          {formatTime(seconds)}
        </Text>
      </View>

      {/* Play/Pause */}
      <Pressable
        onPress={toggle}
        disabled={isStarting}
        accessibilityLabel={isStarting ? "Starting practice…" : isRunning ? "Pause practice" : "Start practice"}
        accessibilityRole="button"
        accessibilityState={{ busy: isStarting }}
        style={({ pressed }) => [
          styles.playBtn,
          {
            backgroundColor: isStarting ? colors.textSecondary : isRunning ? colors.warning : colors.primaryDark,
            transform: [{ scale: pressed && !isStarting ? 0.95 : 1 }],
          },
        ]}
      >
        {isStarting ? (
          <ActivityIndicator size="small" color={colors.buttonText} />
        ) : (
          <Ionicons name={isRunning ? "pause" : "play"} size={22} color={colors.buttonText} />
        )}
      </Pressable>

      {/* Stop */}
      {seconds > 0 ? (
        <Pressable
          onPress={handleStop}
          accessibilityLabel="Stop practice"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.stopBtn,
            {
              backgroundColor: colors.error,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
        >
          <Ionicons name="stop" size={18} color={colors.buttonText} />
          <Text style={[styles.stopText, { color: colors.buttonText }]}>Stop</Text>
        </Pressable>
      ) : (
        <View style={styles.stopPlaceholder} />
      )}
    </View>
  );

  if (minimal && Platform.OS === "ios") {
    return (
      <BlurView intensity={60} tint={isDark ? "dark" : "light"} style={styles.blurWrap}>
        {content}
      </BlurView>
    );
  }

  if (minimal) {
    return (
      <View style={[styles.blurWrap, { backgroundColor: colors.overlay }]}>
        {content}
      </View>
    );
  }

  return content;
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 60,
  },
  containerMinimal: {
    minHeight: 48,
    borderTopWidth: 0,
    paddingHorizontal: Spacing.md,
  },
  blurWrap: {
    overflow: "hidden",
  },
  timer: {
    fontSize: 22,
    fontFamily: "Nunito_700Bold",
    fontWeight: "700",
    letterSpacing: 1,
    minWidth: 80,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    borderRadius: BorderRadius.xs,
  },
  stopText: {
    ...Typography.label,
    fontFamily: "Nunito_600SemiBold",
    fontWeight: "600",
  },
  stopPlaceholder: {
    minWidth: 80,
  },
});
