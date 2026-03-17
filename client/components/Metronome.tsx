import React, { useState, useRef, useEffect, useCallback } from "react";
import { StyleSheet, Text, View, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";

interface MetronomeProps {
  initialBpm?: number;
  onBpmChange?: (bpm: number) => void;
}

export function Metronome({ initialBpm = 120, onBpmChange }: MetronomeProps) {
  const { colors } = useTheme();
  const [bpm, setBpm] = useState(initialBpm);
  const [isPlaying, setIsPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const [timeSignature] = useState(4);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    setBeat((prev) => (prev + 1) % timeSignature);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [timeSignature]);

  useEffect(() => {
    if (isPlaying) {
      const ms = 60000 / bpm;
      intervalRef.current = setInterval(tick, ms);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setBeat(0);
    }
  }, [isPlaying, bpm, tick]);

  const adjustBpm = (delta: number) => {
    const newBpm = Math.max(30, Math.min(240, bpm + delta));
    setBpm(newBpm);
    onBpmChange?.(newBpm);
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.beatsRow}>
        {Array.from({ length: timeSignature }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.beatDot,
              {
                backgroundColor:
                  isPlaying && beat === i
                    ? i === 0
                      ? colors.primary
                      : colors.success
                    : colors.backgroundSecondary,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.bpmRow}>
        <Pressable
          onPress={() => adjustBpm(-5)}
          style={({ pressed }) => [styles.bpmBtn, { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="remove" size={22} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => adjustBpm(-1)}
          style={({ pressed }) => [styles.bpmBtnSmall, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
        </Pressable>
        <View style={styles.bpmDisplay}>
          <Text style={[styles.bpmValue, { color: colors.text }]}>{bpm}</Text>
          <Text style={[styles.bpmLabel, { color: colors.textSecondary }]}>BPM</Text>
        </View>
        <Pressable
          onPress={() => adjustBpm(1)}
          style={({ pressed }) => [styles.bpmBtnSmall, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => adjustBpm(5)}
          style={({ pressed }) => [styles.bpmBtn, { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="add" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>
      <Pressable
        onPress={togglePlay}
        style={({ pressed }) => [
          styles.playBtn,
          {
            backgroundColor: isPlaying ? colors.error : colors.primaryDark,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
          Shadows.lg,
        ]}
      >
        <Ionicons name={isPlaying ? "stop" : "play"} size={28} color={colors.buttonText} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: Spacing.xl, padding: Spacing.xl },
  beatsRow: { flexDirection: "row", gap: Spacing.md },
  beatDot: { width: 16, height: 16, borderRadius: 8 },
  bpmRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  bpmBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  bpmBtnSmall: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  bpmDisplay: { alignItems: "center", minWidth: 80 },
  bpmValue: { fontSize: 36, fontFamily: "Nunito_700Bold", fontWeight: "700" },
  bpmLabel: { ...Typography.label, marginTop: -2 },
  playBtn: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
});
