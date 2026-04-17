import React from "react";
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

  return (
    <View
      testID="progress-track"
      style={[
        styles.track,
        {
          height,
          borderRadius: height / 2,
          backgroundColor: colors.borderLight,
        },
      ]}
    >
      <View
        testID="progress-track-fill"
        style={{
          width: `${clampedPercent}%`,
          height: "100%",
          backgroundColor: fillColor,
          borderRadius: height / 2,
        }}
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
