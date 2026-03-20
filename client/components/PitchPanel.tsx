import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { MusicalStaff } from "@/components/MusicalStaff";
import { CentsIndicator } from "@/components/CentsIndicator";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";
import type { PitchResult } from "@/lib/audio/types";

interface PitchPanelProps {
  width: number;
  isListening: boolean;
  currentPitch: PitchResult | null;
  accuracy: number;
  error?: string | null;
  isRecording: boolean;
}

export const PitchPanel = memo(function PitchPanel({
  width,
  isListening,
  currentPitch,
  accuracy,
  error,
  isRecording,
}: PitchPanelProps) {
  const { colors } = useTheme();
  const innerWidth = width - Spacing.md * 2;
  const staffWidth = Math.min(innerWidth, width - 16);
  const staffHeight = 90;

  return (
    <View style={[styles.container, { width }]}>
      {/* Note name + accidental + solfege at top */}
      {isListening && currentPitch && (
        <View style={styles.noteHeader}>
          <Text style={[styles.noteName, { color: colors.text }]}>
            {currentPitch.note}{currentPitch.octave}
          </Text>
        </View>
      )}

      {/* Compact staff */}
      <View style={styles.staffWrap}>
        <MusicalStaff
          isListening={isListening}
          currentPitch={currentPitch}
          accuracy={accuracy}
          error={error}
          width={staffWidth}
          height={staffHeight}
          compact
        />
      </View>

      {/* Cents indicator */}
      {isListening && currentPitch && (
        <View style={styles.centsWrap}>
          <CentsIndicator cents={currentPitch.cents} width={staffWidth} />
        </View>
      )}

      {/* Tuning status */}
      {isListening && currentPitch && (
        <TuningStatus cents={currentPitch.cents} />
      )}

      {/* Recording indicator */}
      {isRecording && (
        <View style={[styles.recordingBadge, { backgroundColor: colors.errorLight }]}>
          <View style={[styles.recordDot, { backgroundColor: colors.error }]} />
          <Text style={[styles.recordingText, { color: colors.error }]}>REC</Text>
        </View>
      )}

      {/* Not listening message */}
      {!isListening && !error && (
        <View style={styles.idleMessage}>
          <Text style={[styles.idleText, { color: colors.textSecondary }]}>
            Press play to detect pitch
          </Text>
        </View>
      )}
    </View>
  );
});

const TuningStatus = memo(function TuningStatus({ cents }: { cents: number }) {
  const { colors } = useTheme();
  const centsAbs = Math.abs(cents);
  const color = centsAbs <= 10 ? colors.success : centsAbs <= 25 ? colors.warning : colors.error;
  const label = centsAbs <= 10 ? "In Tune" : cents > 0 ? "Sharp" : "Flat";

  return (
    <Text style={[styles.tuningText, { color }]}>{label}</Text>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  noteHeader: {
    marginBottom: Spacing.xs,
    alignItems: "center",
  },
  noteName: {
    fontSize: 20,
    fontFamily: "Nunito_700Bold",
    fontWeight: "700",
  },
  staffWrap: {
    alignItems: "center",
  },
  centsWrap: {
    marginTop: Spacing.sm,
    alignItems: "center",
  },
  tuningText: {
    ...Typography.label,
    fontFamily: "Nunito_600SemiBold",
    fontWeight: "600",
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  recordingBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  recordDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  recordingText: {
    ...Typography.label,
    fontFamily: "Nunito_600SemiBold",
    fontWeight: "600",
  },
  idleMessage: {
    marginTop: Spacing.md,
    alignItems: "center",
  },
  idleText: {
    ...Typography.small,
    textAlign: "center",
  },
});
