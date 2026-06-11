import React, { useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";

interface TempoControlsProps {
  tempo: number;
  onTempoChange: (newTempo: number) => void;
}

export function TempoControls({ tempo, onTempoChange }: TempoControlsProps): React.JSX.Element {
  const { colors } = useTheme();

  const handleDecrease = useCallback(() => {
    onTempoChange(Math.max(0.5, tempo - 0.25));
  }, [tempo, onTempoChange]);

  const handleIncrease = useCallback(() => {
    onTempoChange(Math.min(2.0, tempo + 0.25));
  }, [tempo, onTempoChange]);

  return (
    <View
      style={[styles.tempoControl, { backgroundColor: colors.surface }, Shadows.sm]}
      accessible={true}
      accessibilityValue={{ min: 0.5, max: 2.0, now: tempo, text: `${tempo.toFixed(2)}x speed` }}
    >
      <Ionicons name="speedometer-outline" size={16} color={colors.textSecondary} />
      <Text style={[styles.tempoLabel, { color: colors.textSecondary }]}>Tempo</Text>
      <View style={styles.tempoStepper}>
        <Pressable
          onPress={handleDecrease}
          accessibilityLabel="Decrease tempo"
          accessibilityRole="adjustable"
          style={({ pressed }) => [
            styles.tempoStepBtn,
            { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="remove" size={16} color={colors.text} />
        </Pressable>
        <Text style={[styles.tempoValue, { color: colors.text }]}>
          {tempo.toFixed(2)}x
        </Text>
        <Pressable
          onPress={handleIncrease}
          accessibilityLabel="Increase tempo"
          accessibilityRole="adjustable"
          style={({ pressed }) => [
            styles.tempoStepBtn,
            { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="add" size={16} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const medium = { ...Typography.label, fontFamily: "Nunito_500Medium" as const, fontWeight: "500" as const };
const row = { flexDirection: "row" as const, alignItems: "center" as const };

const styles = StyleSheet.create({
  tempoControl: {
    ...row,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  tempoLabel: { ...medium, flex: 1 },
  tempoStepper: { ...row, gap: Spacing.sm },
  tempoStepBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  tempoValue: { ...Typography.label, fontFamily: "Nunito_700Bold", fontWeight: "700", minWidth: 48, textAlign: "center" },
});
