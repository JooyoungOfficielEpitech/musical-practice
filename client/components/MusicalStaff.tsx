import React, { memo, useState, useEffect, useCallback } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import Svg, { Line, Ellipse, Text as SvgText } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { noteToStaffYDynamic, getStaffLineCount } from "@/lib/audio/staffMapping";
import type { StaffConfig } from "@/lib/audio/staffMapping";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { PitchResult } from "@/lib/audio/types";

interface MusicalStaffProps {
  isListening: boolean;
  currentPitch: PitchResult | null;
  accuracy: number;
  onToggle?: () => void;
  error?: string | null;
  width?: number;
  height?: number;
  compact?: boolean;
}

const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 120;
const DEFAULT_PADDING = 30;
const COMPACT_PADDING = 15;

const MIN_OCTAVE = 1;
const MAX_OCTAVE = 8;
const DEFAULT_LOW = 3;
const DEFAULT_HIGH = 5;

const SOLFEGE: Record<string, string> = {
  C: "도", D: "레", E: "미", F: "파", G: "솔", A: "라", B: "시",
};

function toSolfege(note: string): string {
  const base = note.replace(/[#b]/g, "");
  return SOLFEGE[base] ?? "";
}

export const MusicalStaff = memo(function MusicalStaff({
  isListening,
  currentPitch,
  accuracy,
  onToggle,
  error,
  width: propWidth,
  height: propHeight,
  compact = false,
}: MusicalStaffProps) {
  const { colors } = useTheme();
  const [lowOctave, setLowOctave] = useState(DEFAULT_LOW);
  const [highOctave, setHighOctave] = useState(DEFAULT_HIGH);

  const staffWidth = propWidth ?? DEFAULT_WIDTH;
  const staffHeight = propHeight ?? DEFAULT_HEIGHT;
  const padding = compact ? COMPACT_PADDING : DEFAULT_PADDING;
  const svgHeight = staffHeight + padding * 2;
  const noteCx = staffWidth / 2;
  const scale = staffWidth / DEFAULT_WIDTH;

  const config: StaffConfig = { lowOctave, highOctave };
  const lineCount = getStaffLineCount(config);
  const lineSpacing = staffHeight / Math.max(lineCount - 1, 1);

  // Auto-expand range when out-of-range pitch detected
  useEffect(() => {
    if (!currentPitch) return;
    if (currentPitch.octave < lowOctave) {
      setLowOctave(Math.max(currentPitch.octave, MIN_OCTAVE));
    } else if (currentPitch.octave > highOctave) {
      setHighOctave(Math.min(currentPitch.octave, MAX_OCTAVE));
    }
  }, [currentPitch, lowOctave, highOctave]);

  const decreaseLow = useCallback(() => {
    setLowOctave((prev) => Math.max(prev - 1, MIN_OCTAVE));
  }, []);

  const increaseLow = useCallback(() => {
    setLowOctave((prev) => Math.min(prev + 1, highOctave - 1));
  }, [highOctave]);

  const decreaseHigh = useCallback(() => {
    setHighOctave((prev) => Math.max(prev - 1, lowOctave + 1));
  }, [lowOctave]);

  const increaseHigh = useCallback(() => {
    setHighOctave((prev) => Math.min(prev + 1, MAX_OCTAVE));
  }, []);

  if (error) {
    return (
      <View style={styles.container}>
        <View style={[styles.errorBadge, { backgroundColor: colors.errorLight }]}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      </View>
    );
  }

  const octaveSwitcher = !compact ? (
    <View>
      <Text style={[styles.octaveLabel, { color: colors.textSecondary }]} accessibilityRole="header">
        Singing Range
      </Text>
      <View style={styles.octaveRow}>
        <Pressable
          onPress={decreaseLow}
          accessibilityLabel={`Decrease low octave. Current range: octave ${lowOctave} to ${highOctave}`}
          accessibilityHint="Double tap to decrease"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.octaveBtn,
            { backgroundColor: colors.primaryLight, opacity: lowOctave <= MIN_OCTAVE ? 0.3 : pressed ? 0.7 : 1 },
          ]}
          disabled={lowOctave <= MIN_OCTAVE}
        >
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
        </Pressable>
        <Text style={[styles.octaveValue, { color: colors.primary }]}>{lowOctave}</Text>
        <Pressable
          onPress={increaseLow}
          accessibilityLabel={`Increase low octave. Current range: octave ${lowOctave} to ${highOctave}`}
          accessibilityHint="Double tap to increase"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.octaveBtn,
            { backgroundColor: colors.primaryLight, opacity: lowOctave >= highOctave - 1 ? 0.3 : pressed ? 0.7 : 1 },
          ]}
          disabled={lowOctave >= highOctave - 1}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
        <Text style={[styles.octaveValue, { color: colors.primary }]}>{highOctave}</Text>
        <Pressable
          onPress={decreaseHigh}
          accessibilityLabel={`Decrease high octave. Current range: octave ${lowOctave} to ${highOctave}`}
          accessibilityHint="Double tap to decrease"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.octaveBtn,
            { backgroundColor: colors.primaryLight, opacity: highOctave <= lowOctave + 1 ? 0.3 : pressed ? 0.7 : 1 },
          ]}
          disabled={highOctave <= lowOctave + 1}
        >
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
        </Pressable>
        <Pressable
          onPress={increaseHigh}
          accessibilityLabel={`Increase high octave. Current range: octave ${lowOctave} to ${highOctave}`}
          accessibilityHint="Double tap to increase"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.octaveBtn,
            { backgroundColor: colors.primaryLight, opacity: highOctave >= MAX_OCTAVE ? 0.3 : pressed ? 0.7 : 1 },
          ]}
          disabled={highOctave >= MAX_OCTAVE}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  ) : null;

  if (!isListening) {
    return (
      <View style={styles.container}>
        {octaveSwitcher}
        <DynamicStaffLines colors={colors} lineCount={lineCount} lineSpacing={lineSpacing} staffWidth={staffWidth} staffHeight={staffHeight} padding={padding} />
        {onToggle && !compact && (
          <Pressable
            onPress={onToggle}
            accessibilityLabel="Start pitch detection"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.micButton,
              { backgroundColor: colors.primaryLight, opacity: pressed ? 0.7 : 1, marginTop: -svgHeight / 2 - 10 },
            ]}
          >
            <Ionicons name="mic-outline" size={28} color={colors.primary} />
            <Text style={[styles.micText, { color: colors.primary }]}>Tap to detect pitch</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (!currentPitch) {
    return (
      <View style={styles.container}>
        {octaveSwitcher}
        <DynamicStaffLines colors={colors} lineCount={lineCount} lineSpacing={lineSpacing} staffWidth={staffWidth} staffHeight={staffHeight} padding={padding} />
        <View style={[styles.listeningRow, { marginTop: -svgHeight / 2 - 10 }]}>
          <Text style={[styles.listeningText, { color: colors.textSecondary }]}>Listening...</Text>
          {onToggle && !compact && (
            <Pressable
              onPress={onToggle}
              accessibilityLabel="Stop pitch detection"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.stopButton,
                { backgroundColor: colors.errorLight, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="stop-circle-outline" size={20} color={colors.error} />
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // Pitch detected — render note on staff
  const centsAbs = Math.abs(currentPitch.cents);
  const noteColor =
    centsAbs <= 10 ? colors.success : centsAbs <= 25 ? colors.warning : colors.error;
  const tuningLabel =
    centsAbs <= 10 ? "In Tune" : currentPitch.cents > 0 ? "Sharp" : "Flat";

  const staffPos = noteToStaffYDynamic(currentPitch.note, currentPitch.octave, staffHeight, config);
  const noteY = padding + staffPos.y;

  // Scaled sizes
  const noteRx = Math.round(10 * scale);
  const noteRy = Math.round(7 * scale);
  const accidentalSize = Math.round(16 * scale);
  const clefSize = Math.round(14 * scale);
  const noteNameSize = compact ? 18 : 24;

  return (
    <View style={styles.container}>
      {octaveSwitcher}
      <Svg width={staffWidth} height={svgHeight}>
        {/* Staff lines */}
        {Array.from({ length: lineCount }).map((_, i) => (
          <Line
            key={`line-${i}`}
            x1={20 * scale}
            y1={padding + i * lineSpacing}
            x2={staffWidth - 20 * scale}
            y2={padding + i * lineSpacing}
            stroke={colors.borderLight}
            strokeWidth={1.5}
          />
        ))}

        {/* Note head */}
        <Ellipse
          testID="note-head"
          cx={noteCx}
          cy={noteY}
          rx={noteRx}
          ry={noteRy}
          fill={staffPos.outOfRange ? colors.error : noteColor}
        />

        {/* Accidental */}
        {staffPos.accidental && (
          <SvgText
            x={noteCx - 18 * scale}
            y={noteY + 5 * scale}
            fontSize={accidentalSize}
            fill={colors.text}
            fontWeight="bold"
          >
            {staffPos.accidental === "sharp" ? "♯" : "♭"}
          </SvgText>
        )}

        {/* Treble clef hint */}
        <SvgText
          x={25 * scale}
          y={padding + staffHeight / 2 + 5 * scale}
          fontSize={clefSize}
          fill={colors.textSecondary}
        >
          𝄞
        </SvgText>
      </Svg>

      <View style={styles.infoRow}>
        <Text style={[styles.noteName, { color: noteColor, fontSize: noteNameSize }]}>
          {currentPitch.note}{currentPitch.octave}
        </Text>
        <View style={[styles.solfegeBadge, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.solfegeText, { color: colors.primary }]}>
            {toSolfege(currentPitch.note)}
          </Text>
        </View>
        <View style={[styles.tuningBadge, { backgroundColor: noteColor === colors.success ? colors.successLight : noteColor === colors.warning ? colors.warningSubtle : colors.errorLight }]}>
          <Text style={[styles.tuningText, { color: noteColor }]}>{tuningLabel}</Text>
        </View>
        {onToggle && !compact && (
          <Pressable
            onPress={onToggle}
            accessibilityLabel="Stop pitch detection"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.stopButton,
              { backgroundColor: colors.errorLight, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="stop-circle-outline" size={20} color={colors.error} />
          </Pressable>
        )}
      </View>

      {!compact && (
        <Text style={[styles.frequency, { color: colors.textSecondary }]}>
          {currentPitch.frequency.toFixed(1)} Hz
        </Text>
      )}

      {!compact && accuracy > 0 && (
        <View style={[styles.accuracyBadge, { backgroundColor: colors.successLight }]}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={[styles.accuracyText, { color: colors.success }]}>
            Accuracy: {accuracy}%
          </Text>
        </View>
      )}
    </View>
  );
});

/** Dynamic staff lines based on octave range */
const DynamicStaffLines = memo(function DynamicStaffLines({
  colors,
  lineCount,
  lineSpacing,
  staffWidth,
  staffHeight,
  padding,
}: {
  colors: any;
  lineCount: number;
  lineSpacing: number;
  staffWidth: number;
  staffHeight: number;
  padding: number;
}) {
  const scale = staffWidth / DEFAULT_WIDTH;
  const svgHeight = staffHeight + padding * 2;
  return (
    <Svg width={staffWidth} height={svgHeight}>
      {Array.from({ length: lineCount }).map((_, i) => (
        <Line
          key={`bg-line-${i}`}
          x1={20 * scale}
          y1={padding + i * lineSpacing}
          x2={staffWidth - 20 * scale}
          y2={padding + i * lineSpacing}
          stroke={colors.borderLight}
          strokeWidth={1.5}
        />
      ))}
      <SvgText
        x={25 * scale}
        y={padding + staffHeight / 2 + 5 * scale}
        fontSize={Math.round(14 * scale)}
        fill={colors.textSecondary}
      >
        𝄞
      </SvgText>
    </Svg>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  octaveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  octaveBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  octaveValue: {
    fontSize: 16,
    fontFamily: "Nunito_700Bold",
    fontWeight: "700",
    minWidth: 20,
    textAlign: "center",
  },
  octaveLabel: {
    ...Typography.small,
    fontFamily: "Nunito_500Medium",
    fontWeight: "500",
    marginHorizontal: Spacing.xs,
  },
  micButton: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing["3xl"],
    borderRadius: BorderRadius.md,
  },
  micText: {
    ...Typography.body,
    fontFamily: "Nunito_500Medium",
    fontWeight: "500",
  },
  listeningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  listeningText: {
    ...Typography.body,
  },
  stopButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  noteName: {
    fontFamily: "Nunito_700Bold",
    fontWeight: "700",
  },
  solfegeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  solfegeText: {
    ...Typography.label,
    fontFamily: "Nunito_700Bold",
    fontWeight: "700",
  },
  tuningBadge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  tuningText: {
    ...Typography.label,
    fontFamily: "Nunito_600SemiBold",
    fontWeight: "600",
  },
  frequency: {
    ...Typography.small,
  },
  accuracyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  accuracyText: {
    ...Typography.label,
    fontFamily: "Nunito_600SemiBold",
    fontWeight: "600",
  },
  errorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  errorText: {
    ...Typography.small,
    flex: 1,
  },
});
