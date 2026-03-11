import React, { useState, useRef, useEffect, useCallback } from "react";
import { StyleSheet, Text, View, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

interface MetronomeProps {
  initialBpm?: number;
  onBpmChange?: (bpm: number) => void;
}

export function Metronome({ initialBpm = 120, onBpmChange }: MetronomeProps) {
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
                      ? Colors.light.primary
                      : Colors.light.success
                    : Colors.light.surfaceSecondary,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.bpmRow}>
        <Pressable
          onPress={() => adjustBpm(-5)}
          style={({ pressed }) => [styles.bpmBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="remove" size={22} color={Colors.light.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => adjustBpm(-1)}
          style={({ pressed }) => [styles.bpmBtnSmall, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="chevron-back" size={16} color={Colors.light.textTertiary} />
        </Pressable>
        <View style={styles.bpmDisplay}>
          <Text style={styles.bpmValue}>{bpm}</Text>
          <Text style={styles.bpmLabel}>BPM</Text>
        </View>
        <Pressable
          onPress={() => adjustBpm(1)}
          style={({ pressed }) => [styles.bpmBtnSmall, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="chevron-forward" size={16} color={Colors.light.textTertiary} />
        </Pressable>
        <Pressable
          onPress={() => adjustBpm(5)}
          style={({ pressed }) => [styles.bpmBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="add" size={22} color={Colors.light.textSecondary} />
        </Pressable>
      </View>
      <Pressable
        onPress={togglePlay}
        style={({ pressed }) => [
          styles.playBtn,
          {
            backgroundColor: isPlaying ? Colors.light.error : Colors.light.primaryDark,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
        ]}
      >
        <Ionicons
          name={isPlaying ? "stop" : "play"}
          size={28}
          color={Colors.light.primaryText}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 20,
    padding: 20,
  },
  beatsRow: {
    flexDirection: "row",
    gap: 12,
  },
  beatDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  bpmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bpmBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  bpmBtnSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  bpmDisplay: {
    alignItems: "center",
    minWidth: 80,
  },
  bpmValue: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  bpmLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textTertiary,
    marginTop: -2,
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
});
