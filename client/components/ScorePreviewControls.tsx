import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { TempoControls } from "@/components/PracticeTempoControls";
import { SeekBar } from "@/components/SeekBar";
import type { LoopRange } from "@/hooks/useSynthPlayer";
import { BorderRadius, ClayShadowSmall, Shadows, Spacing, Typography } from "@/constants/theme";

function formatSynthTime(seconds: number): string {
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

export interface ScorePreviewControlsProps {
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  tempo: number;
  onTempoChange: (tempo: number) => void;
  instrument: string;
  instrumentLoading: boolean;
  onPlayPause: () => void;
  editMode: boolean;
  onToggleEdit: () => void;
  hasEdits: boolean;
  onOpenInstrumentPicker: () => void;
  /** When true, render only the transport + tempo (the edit/sound rows are
   *  surfaced elsewhere, e.g. a compact tools row). */
  compact?: boolean;
  loopRange?: LoopRange | null;
  onSeek?: (ms: number) => void;
}

export function ScorePreviewControls({
  isPlaying, positionMs, durationMs, tempo, onTempoChange,
  instrument, instrumentLoading, onPlayPause, editMode, onToggleEdit,
  hasEdits, onOpenInstrumentPicker, compact = false,
  loopRange = null, onSeek,
}: ScorePreviewControlsProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <>
      <View style={[styles.synthControls, { backgroundColor: colors.surface }, Shadows.sm]}>
        <Pressable onPress={onPlayPause} accessibilityLabel={isPlaying ? "Pause synth" : "Play synth"} accessibilityRole="button" style={({ pressed }) => [styles.synthPlayButton, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}>
          <Ionicons name={isPlaying ? "pause" : "play"} size={20} color={colors.buttonText} />
        </Pressable>
        <View style={styles.synthTrackSection}>
          {onSeek ? (
            <SeekBar
              positionMs={positionMs}
              durationMs={durationMs}
              loopRange={loopRange}
              onSeek={onSeek}
            />
          ) : (
            <View style={[styles.synthTrackBg, { backgroundColor: colors.borderLight }]}>
              <View style={[styles.synthTrackProgress, { backgroundColor: colors.primary, width: durationMs > 0 ? `${(positionMs / durationMs) * 100}%` : "0%" }]} />
            </View>
          )}
          <View style={styles.synthTimeRow}>
            <Text style={[styles.synthTimeText, { color: colors.textSecondary }]}>{formatSynthTime(positionMs / 1000)}</Text>
            <Text style={[styles.synthTimeText, { color: colors.textSecondary }]}>{formatSynthTime(durationMs / 1000)}</Text>
          </View>
        </View>
      </View>
      <TempoControls tempo={tempo} onTempoChange={onTempoChange} />
    </>
  );
}

const row = { flexDirection: "row" as const, alignItems: "center" as const };
const semibold = { ...Typography.label, fontFamily: "Nunito_600SemiBold" as const, fontWeight: "600" as const };
const medium = { ...Typography.label, fontFamily: "Nunito_500Medium" as const, fontWeight: "500" as const };

const styles = StyleSheet.create({
  synthControls: { ...row, padding: Spacing.md, borderRadius: 32, gap: Spacing.md, marginTop: Spacing.sm, ...ClayShadowSmall },
  synthPlayButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  synthTrackSection: { flex: 1, gap: Spacing.xs },
  synthTrackBg: { height: 8, borderRadius: 4, overflow: "hidden" },
  synthTrackProgress: { height: "100%", borderRadius: 2 },
  synthTimeRow: { flexDirection: "row", justifyContent: "space-between" },
  synthTimeText: medium,
  instrumentRow: { ...row, padding: Spacing.sm, borderRadius: BorderRadius.md, gap: Spacing.sm, marginTop: Spacing.xs },
  instrumentButtons: { ...row, gap: Spacing.xs },
  instrumentBtnText: semibold,
});
