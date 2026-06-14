import React, { useCallback } from "react";
import { Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";

interface TempoPresetsProps {
  tempo: number;
  onTempoChange: (newTempo: number) => void;
  presets?: number[];
}

const DEFAULT_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const TEMPO_TOLERANCE = 0.01;

export function TempoPresets({
  tempo,
  onTempoChange,
  presets = DEFAULT_PRESETS,
}: TempoPresetsProps): React.JSX.Element {
  const { colors } = useTheme();

  const isPresetActive = (preset: number): boolean => {
    return Math.abs(tempo - preset) < TEMPO_TOLERANCE;
  };

  const handlePress = useCallback(
    (preset: number) => {
      onTempoChange(preset);
    },
    [onTempoChange]
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEnabled={false}
      style={[styles.container, { backgroundColor: colors.surface }, Shadows.sm]}
      contentContainerStyle={styles.content}
    >
      {presets.map((preset) => (
        <Pressable
          key={preset}
          onPress={() => handlePress(preset)}
          accessibilityLabel={`Set tempo to ${preset}x`}
          accessibilityRole="radio"
          accessibilityState={{ selected: isPresetActive(preset) }}
          style={({ pressed }) => [
            styles.presetBtn,
            {
              backgroundColor: isPresetActive(preset)
                ? colors.primary
                : colors.backgroundSecondary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.presetText,
              {
                color: isPresetActive(preset) ? colors.buttonText : colors.text,
              },
            ]}
          >
            {`${preset.toFixed(2)}x`}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const medium = {
  ...Typography.label,
  fontFamily: "Nunito_500Medium" as const,
  fontWeight: "500" as const,
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
  },
  content: {
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  presetBtn: {
    height: 44,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  presetText: {
    ...medium,
    fontSize: 12,
  },
});
