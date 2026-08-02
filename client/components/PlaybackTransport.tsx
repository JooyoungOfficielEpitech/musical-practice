import React, { useState, useRef, useCallback, useEffect } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { hapticFeedback } from "@/lib/hapticFeedback";
import { SeekBar } from "@/components/SeekBar";
import {
  makeLoopRange,
  scaledToOriginalMs,
  originalToScaledMs,
} from "@/lib/audio/transportMath";
import { TRANSPOSE_MIN, TRANSPOSE_MAX } from "@/lib/audio/playbackNotes";
import { Spacing, BorderRadius, Typography, Fonts } from "@/constants/theme";
import type { UseSynthPlayerReturn } from "@/hooks/useSynthPlayer";

const TEMPO_STEP = 0.1, TEMPO_MIN = 0.5, TEMPO_MAX = 2.0;

export interface PlaybackTransportProps {
  synthPlayer: UseSynthPlayerReturn;
  onPlayPause: () => void;
  transpose: number;
  onTransposeChange: (semitones: number) => void;
  metronomeOn: boolean;
  onToggleMetronome: () => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Practice transport: scrubber, play/pause, A–B loop, metronome, and
 * tempo/pitch steppers. Loop anchors live in original-score time so an active
 * loop survives tempo changes.
 */
function PlaybackTransportComponent({
  synthPlayer,
  onPlayPause,
  transpose,
  onTransposeChange,
  metronomeOn,
  onToggleMetronome,
}: PlaybackTransportProps): React.JSX.Element {
  const { colors } = useTheme();
  const { positionMs, durationMs, tempo, loopRange, isPlaying } = synthPlayer;

  // A–B loop: anchor A (original-time ms) is armed first; the second press
  // completes the range. An active loop's original-time bounds are kept so a
  // tempo change can rescale the player's (tempo-scaled) range.
  const [loopAnchorMs, setLoopAnchorMs] = useState<number | null>(null);
  const loopOriginalRef = useRef<{ aMs: number; bMs: number } | null>(null);

  const handleLoopPress = useCallback(() => {
    void hapticFeedback.triggerLight();
    if (loopRange) {
      synthPlayer.clearLoopRange();
      loopOriginalRef.current = null;
      setLoopAnchorMs(null);
      return;
    }
    if (loopAnchorMs === null) {
      setLoopAnchorMs(scaledToOriginalMs(positionMs, tempo));
      return;
    }
    const range = makeLoopRange(
      originalToScaledMs(loopAnchorMs, tempo),
      positionMs,
      durationMs,
    );
    if (!range) return; // points too close — stay armed until a usable B
    loopOriginalRef.current = {
      aMs: scaledToOriginalMs(range.startMs, tempo),
      bMs: scaledToOriginalMs(range.endMs, tempo),
    };
    synthPlayer.setLoopRange(range);
    setLoopAnchorMs(null);
  }, [loopRange, loopAnchorMs, positionMs, durationMs, tempo, synthPlayer]);

  // Rescale the active loop when the tempo changes.
  const prevTempoRef = useRef(tempo);
  useEffect(() => {
    if (prevTempoRef.current === tempo) return;
    prevTempoRef.current = tempo;
    const original = loopOriginalRef.current;
    if (!original || !loopRange) return;
    const range = makeLoopRange(
      originalToScaledMs(original.aMs, tempo),
      originalToScaledMs(original.bMs, tempo),
      durationMs,
    );
    if (range) synthPlayer.setLoopRange(range);
  }, [tempo, durationMs, loopRange, synthPlayer]);

  const loopLabel = loopRange
    ? "Clear loop"
    : loopAnchorMs !== null
      ? "Set loop end"
      : "Set loop start";
  const loopActive = !!loopRange || loopAnchorMs !== null;

  const transposeLabel =
    transpose === 0 ? "0 st" : `${transpose > 0 ? "+" : ""}${transpose} st`;

  return (
    <View style={styles.container}>
      <SeekBar
        positionMs={positionMs}
        durationMs={durationMs}
        loopRange={loopRange}
        onSeek={synthPlayer.seekTo}
      />
      <View style={styles.timeRow}>
        <Text style={[styles.timeText, { color: colors.textSecondary }]}>{formatTime(positionMs)}</Text>
        <Text style={[styles.timeText, { color: colors.textSecondary }]}>{formatTime(durationMs)}</Text>
      </View>

      <View style={[styles.mainRow, { backgroundColor: colors.surface }]}>
        <Pressable
          onPress={() => {
            void hapticFeedback.triggerMedium();
            onPlayPause();
          }}
          accessibilityLabel={isPlaying ? "Pause" : "Play"}
          accessibilityRole="button"
          style={({ pressed }) => [styles.playBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
        >
          <Ionicons name={isPlaying ? "pause" : "play"} size={22} color={colors.buttonText} />
        </Pressable>

        <Pressable
          onPress={handleLoopPress}
          accessibilityLabel={loopLabel}
          accessibilityRole="button"
          style={[styles.toggleBtn, loopActive && { backgroundColor: colors.primarySubtle ?? colors.borderLight }]}
        >
          <Ionicons name="repeat" size={20} color={loopActive ? colors.primary : colors.text} />
          <Text style={[styles.toggleText, { color: loopActive ? colors.primary : colors.textSecondary }]}>
            {loopRange ? "A–B" : loopAnchorMs !== null ? "A…" : "Loop"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            void hapticFeedback.triggerLight();
            onToggleMetronome();
          }}
          accessibilityLabel="Toggle metronome"
          accessibilityRole="button"
          accessibilityState={{ selected: metronomeOn }}
          style={[styles.toggleBtn, metronomeOn && { backgroundColor: colors.primarySubtle ?? colors.borderLight }]}
        >
          <Ionicons name="pulse" size={20} color={metronomeOn ? colors.primary : colors.text} />
          <Text style={[styles.toggleText, { color: metronomeOn ? colors.primary : colors.textSecondary }]}>Click</Text>
        </Pressable>
      </View>

      <View style={styles.stepperRow}>
        <Stepper
          label="TEMPO"
          value={`${(tempo * 100).toFixed(0)}%`}
          onDecrease={() => synthPlayer.setTempo(Math.max(TEMPO_MIN, tempo - TEMPO_STEP))}
          onIncrease={() => synthPlayer.setTempo(Math.min(TEMPO_MAX, tempo + TEMPO_STEP))}
          decreaseLabel="Decrease tempo"
          increaseLabel="Increase tempo"
        />
        <Stepper
          label="PITCH"
          value={transposeLabel}
          onDecrease={() => onTransposeChange(Math.max(TRANSPOSE_MIN, transpose - 1))}
          onIncrease={() => onTransposeChange(Math.min(TRANSPOSE_MAX, transpose + 1))}
          decreaseLabel="Transpose down"
          increaseLabel="Transpose up"
        />
      </View>
    </View>
  );
}

interface StepperProps {
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseLabel: string;
  increaseLabel: string;
}

function Stepper({ label, value, onDecrease, onIncrease, decreaseLabel, increaseLabel }: StepperProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[styles.stepper, { backgroundColor: colors.surface }]}>
      <Text style={[styles.stepperLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          onPress={() => {
            void hapticFeedback.triggerLight();
            onDecrease();
          }}
          accessibilityLabel={decreaseLabel}
          accessibilityRole="button"
          style={[styles.stepperBtn, { backgroundColor: colors.backgroundSecondary }]}
        >
          <Ionicons name="remove" size={16} color={colors.text} />
        </Pressable>
        <Text style={[styles.stepperValue, { color: colors.text }]}>{value}</Text>
        <Pressable
          onPress={() => {
            void hapticFeedback.triggerLight();
            onIncrease();
          }}
          accessibilityLabel={increaseLabel}
          accessibilityRole="button"
          style={[styles.stepperBtn, { backgroundColor: colors.backgroundSecondary }]}
        >
          <Ionicons name="add" size={16} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

export const PlaybackTransport = React.memo(PlaybackTransportComponent);

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.lg, marginVertical: Spacing.md, gap: Spacing.sm },
  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  timeText: { ...Typography.small, fontVariant: ["tabular-nums"] },
  mainRow: {
    flexDirection: "row", alignItems: "center", gap: Spacing.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm,
  },
  playBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  toggleBtn: {
    flexDirection: "row", alignItems: "center", gap: Spacing.xs,
    paddingHorizontal: Spacing.md, minHeight: 44, borderRadius: BorderRadius.sm,
  },
  toggleText: { ...Typography.small, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
  stepperRow: { flexDirection: "row", gap: Spacing.sm },
  stepper: {
    flex: 1, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs,
  },
  stepperLabel: { ...Typography.label, fontSize: 10 },
  stepperControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepperBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  stepperValue: { ...Typography.body, fontFamily: Fonts.bodySemiBold, fontWeight: "600", fontVariant: ["tabular-nums"] },
});
