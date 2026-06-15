import React, { useState, useRef, useEffect, useCallback } from "react";
import { StyleSheet, Text, View, Pressable, Platform, TextInput, AppState } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { createAudioPlayer } from "expo-audio";
import type { AudioPlayer } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";
import { encodeWav } from "@/lib/audio/wavEncoder";

interface MetronomeProps {
  initialBpm?: number;
  onBpmChange?: (bpm: number) => void;
  compact?: boolean;
}

export function Metronome({ initialBpm = 120, onBpmChange, compact }: MetronomeProps) {
  const { colors } = useTheme();
  const [bpm, setBpm] = useState(initialBpm);
  const [isPlaying, setIsPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const [timeSignature] = useState(4);
  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const [editBpmText, setEditBpmText] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accentSoundRef = useRef<AudioPlayer | null>(null);
  const regularSoundRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initSounds() {
      const sampleRate = 22050;
      const numSamples = Math.floor(sampleRate * 0.08);
      const configs = [
        { freq: 880, path: `${FileSystem.cacheDirectory}metro_accent.wav`, ref: accentSoundRef },
        { freq: 660, path: `${FileSystem.cacheDirectory}metro_regular.wav`, ref: regularSoundRef },
      ];

      for (const { freq, path, ref } of configs) {
        const samples = new Float32Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
          const envelope = 1 - i / numSamples;
          samples[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * envelope * 0.8;
        }
        const wavBuffer = encodeWav([samples], sampleRate);
        const uint8 = new Uint8Array(wavBuffer);
        let binary = "";
        for (let i = 0; i < uint8.length; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64 = btoa(binary);
        await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
        if (cancelled) return;
        const sound = createAudioPlayer({ uri: path });
        if (cancelled) { sound.remove(); return; }
        ref.current = sound;
      }
    }

    initSounds();

    return () => {
      cancelled = true;
      accentSoundRef.current?.remove();
      regularSoundRef.current?.remove();
    };
  }, []);

  const tick = useCallback(() => {
    setBeat((prev) => {
      const next = (prev + 1) % timeSignature;
      const sound = next === 0 ? accentSoundRef.current : regularSoundRef.current;
      if (sound) { sound.seekTo(0); sound.play(); }
      return next;
    });
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

  // Pause metronome when app backgrounds
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && isPlaying) {
        setIsPlaying(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isPlaying]);

  const adjustBpm = (delta: number) => {
    setBpm((prev) => {
      const newBpm = Math.max(30, Math.min(240, prev + delta));
      onBpmChange?.(newBpm);
      return newBpm;
    });
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
  };

  const handleBpmSubmit = useCallback(() => {
    const parsed = parseInt(editBpmText, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(30, Math.min(240, parsed));
      setBpm(clamped);
      onBpmChange?.(clamped);
    }
    setIsEditingBpm(false);
  }, [editBpmText, onBpmChange]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  return (
    <View style={compact ? styles.containerCompact : styles.container}>
      <View
        style={compact ? styles.beatsRowCompact : styles.beatsRow}
        accessibilityLabel={isPlaying ? `Beat ${beat + 1} of ${timeSignature}` : `${timeSignature} beats`}
        accessibilityRole="text"
      >
        {Array.from({ length: timeSignature }).map((_, i) => (
          <View
            key={i}
            style={[
              compact ? styles.beatDotCompact : styles.beatDot,
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
          accessibilityLabel="Decrease BPM by 5"
          accessibilityRole="button"
          android_ripple={{ color: colors.ripple }}
          style={({ pressed }) => [styles.bpmBtn, { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="remove" size={22} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => adjustBpm(-1)}
          accessibilityLabel="Decrease BPM by 1"
          accessibilityRole="button"
          android_ripple={{ color: colors.ripple }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={({ pressed }) => [styles.bpmBtnSmall, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => { setEditBpmText(String(bpm)); setIsEditingBpm(true); }}
          accessibilityLabel="Tap to enter BPM directly"
          accessibilityRole="button"
          style={styles.bpmDisplay}
        >
          {isEditingBpm ? (
            <TextInput
              style={[compact ? styles.bpmInputCompact : styles.bpmInput, { color: colors.text, borderBottomColor: colors.primary }]}
              value={editBpmText}
              onChangeText={setEditBpmText}
              keyboardType="number-pad"
              autoFocus
              selectTextOnFocus
              onSubmitEditing={handleBpmSubmit}
              onBlur={handleBpmSubmit}
              returnKeyType="done"
              maxLength={3}
            />
          ) : (
            <Text style={[compact ? styles.bpmValueCompact : styles.bpmValue, { color: colors.text }]}>{bpm}</Text>
          )}
          <Text style={[styles.bpmLabel, { color: colors.textSecondary }]}>BPM</Text>
        </Pressable>
        <Pressable
          onPress={() => adjustBpm(1)}
          accessibilityLabel="Increase BPM by 1"
          accessibilityRole="button"
          android_ripple={{ color: colors.ripple }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={({ pressed }) => [styles.bpmBtnSmall, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => adjustBpm(5)}
          accessibilityLabel="Increase BPM by 5"
          accessibilityRole="button"
          android_ripple={{ color: colors.ripple }}
          style={({ pressed }) => [styles.bpmBtn, { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="add" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>
      <Pressable
        onPress={togglePlay}
        accessibilityLabel={isPlaying ? "Stop metronome" : "Start metronome"}
        accessibilityRole="button"
        android_ripple={{ color: colors.rippleLight }}
        style={({ pressed }) => [
          compact ? styles.playBtnCompact : styles.playBtn,
          {
            backgroundColor: isPlaying ? colors.error : colors.primaryDark,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
          Shadows.lg,
        ]}
      >
        <Ionicons name={isPlaying ? "stop" : "play"} size={compact ? 20 : 28} color={colors.buttonText} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: Spacing.xl, padding: Spacing.xl },
  containerCompact: { alignItems: "center", gap: Spacing.sm, padding: Spacing.sm },
  beatsRow: { flexDirection: "row", gap: Spacing.md },
  beatsRowCompact: { flexDirection: "row", gap: Spacing.sm },
  beatDot: { width: 16, height: 16, borderRadius: 8 },
  beatDotCompact: { width: 10, height: 10, borderRadius: 5 },
  bpmRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  bpmBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  bpmBtnSmall: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  bpmDisplay: { alignItems: "center", minWidth: 80 },
  bpmValue: { fontSize: 36, fontFamily: "Nunito_700Bold", fontWeight: "700" },
  bpmValueCompact: { fontSize: 24, fontFamily: "Nunito_700Bold", fontWeight: "700" },
  bpmInput: { fontSize: 36, fontFamily: "Nunito_700Bold", fontWeight: "700", textAlign: "center", minWidth: 80, borderBottomWidth: 2, padding: 0 },
  bpmInputCompact: { fontSize: 24, fontFamily: "Nunito_700Bold", fontWeight: "700", textAlign: "center", minWidth: 60, borderBottomWidth: 2, padding: 0 },
  bpmLabel: { ...Typography.label, marginTop: -2 },
  playBtn: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  playBtnCompact: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
