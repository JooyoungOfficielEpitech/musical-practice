import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Fonts } from "@/constants/theme";

export interface NoteEditStepperProps {
  label: string;
  valueLabel: string;
  onDown: () => void;
  onUp: () => void;
  downLabel: string;
  upLabel: string;
  disabled: boolean;
}

/** −/value/+ row used by the note-edit sheet (semitone, octave). */
export function NoteEditStepper({
  label, valueLabel, onDown, onUp, downLabel, upLabel, disabled,
}: NoteEditStepperProps): React.JSX.Element {
  const { colors } = useTheme();
  const btnStyle = ({ pressed }: { pressed: boolean }) => [
    styles.smallBtn,
    { backgroundColor: colors.backgroundSecondary, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
  ];
  return (
    <View style={styles.controlGroup}>
      <Text style={[styles.controlLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.buttonRow}>
        <Pressable onPress={onDown} disabled={disabled} accessibilityLabel={downLabel} accessibilityRole="button" style={btnStyle}>
          <Ionicons name="remove-outline" size={18} color={colors.text} />
        </Pressable>
        <Text style={[styles.buttonLabel, { color: colors.text }]}>{valueLabel}</Text>
        <Pressable onPress={onUp} disabled={disabled} accessibilityLabel={upLabel} accessibilityRole="button" style={btnStyle}>
          <Ionicons name="add-outline" size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controlGroup: { gap: Spacing.sm },
  controlLabel: { fontSize: 12, fontFamily: Fonts.bodyBold, fontWeight: "600", marginLeft: Spacing.sm },
  buttonRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.md },
  smallBtn: { width: 44, height: 44, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  buttonLabel: { fontSize: 14, fontFamily: Fonts.bodyBold, fontWeight: "600", minWidth: 40, textAlign: "center" },
});
