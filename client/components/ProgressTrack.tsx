import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";

interface ProgressTrackProps {
  percent: number;
  height?: number;
  color?: string;
  animated?: boolean;
}

export function ProgressTrack({
  percent,
  height = 6,
  color,
  animated = true,
}: ProgressTrackProps): React.ReactElement {
  const { colors } = useTheme();
  const fillColor = color ?? colors.primary;
  const clampedPercent = Math.min(100, Math.max(0, percent));

  const fillStyle = useMemo(
    () => ({
      width: `${clampedPercent}%` as const,
      height: "100%" as const,
      backgroundColor: fillColor,
      borderRadius: height / 2,
    }),
    [clampedPercent, fillColor, height],
  );

  const trackContainerStyle = useMemo(
    () => ({
      height,
      borderRadius: height / 2,
      backgroundColor: colors.borderLight,
    }),
    [height, colors.borderLight],
  );

  return (
    <View
      testID="progress-track"
      accessible={true}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: clampedPercent,
        text: `${clampedPercent}% complete`,
      }}
      style={[styles.track, trackContainerStyle]}
    >
      <View
        testID="progress-track-fill"
        style={fillStyle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: "hidden",
    width: "100%",
  },
});
