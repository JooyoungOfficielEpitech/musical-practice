import React, { useState, useEffect } from "react";
import { StyleSheet, View, Modal, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { hapticFeedback } from "@/lib/hapticFeedback";
import { Spacing, BorderRadius, ClayShadow, Fonts } from "@/constants/theme";

export interface NoteEditSheetProps {
  visible: boolean;
  selectedPitch: { step: string; alter: number; octave: number } | null;
  /** False when the tapped note can't be located safely — editing disabled. */
  canEdit: boolean;
  onApply: (step: string, alter: number, octave: number) => void;
  onDismiss: () => void;
}

const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES: { step: string; alter: number }[] = [
  { step: "C", alter: 0 }, { step: "C", alter: 1 }, { step: "D", alter: 0 },
  { step: "D", alter: 1 }, { step: "E", alter: 0 }, { step: "F", alter: 0 },
  { step: "F", alter: 1 }, { step: "G", alter: 0 }, { step: "G", alter: 1 },
  { step: "A", alter: 0 }, { step: "A", alter: 1 }, { step: "B", alter: 0 },
];
const MIDI_MIN = 24; // C1
const MIDI_MAX = 108; // C8

function pitchToMidi(step: string, alter: number, octave: number): number {
  return (octave + 1) * 12 + (STEP_SEMITONES[step] ?? 0) + alter;
}

function midiToPitch(midi: number): { step: string; alter: number; octave: number } {
  const name = SHARP_NAMES[((midi % 12) + 12) % 12];
  return { step: name.step, alter: name.alter, octave: Math.floor(midi / 12) - 1 };
}

function pitchLabelOf(step: string, alter: number, octave: number): string {
  return `${step}${alter === 1 ? "#" : alter === -1 ? "b" : ""}${octave}`;
}

/**
 * Bottom sheet for fixing a single scanned note: semitone and octave steppers
 * on a midi basis (a semitone up from C4 is C#4, never D#4), Apply/Cancel.
 */
export function NoteEditSheet({
  visible, selectedPitch, canEdit, onApply, onDismiss,
}: NoteEditSheetProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const [workingMidi, setWorkingMidi] = useState(60);

  useEffect(() => {
    if (visible && selectedPitch) {
      setWorkingMidi(pitchToMidi(selectedPitch.step, selectedPitch.alter, selectedPitch.octave));
    }
  }, [visible, selectedPitch]);

  if (!visible || !selectedPitch) return null;

  const working = midiToPitch(workingMidi);
  const pitchLabel = pitchLabelOf(working.step, working.alter, working.octave);
  const originalLabel = pitchLabelOf(selectedPitch.step, selectedPitch.alter, selectedPitch.octave);
  const changed = workingMidi !== pitchToMidi(selectedPitch.step, selectedPitch.alter, selectedPitch.octave);

  const shift = (delta: number) => {
    void hapticFeedback.triggerLight();
    setWorkingMidi((m) => Math.max(MIDI_MIN, Math.min(MIDI_MAX, m + delta)));
  };

  const handleApply = () => {
    if (!canEdit) return;
    void hapticFeedback.triggerMedium();
    onApply(working.step, working.alter, working.octave);
  };

  const handleDismiss = () => {
    void hapticFeedback.triggerLight();
    onDismiss();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={handleDismiss} accessibilityViewIsModal>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={handleDismiss}
        accessibilityLabel="Dismiss"
      />
      <SafeAreaView testID="note-edit-sheet" style={[styles.sheet, { backgroundColor: colors.surface }]} edges={["bottom"]}>
        <View style={styles.header}>
          <View style={[styles.handle, { backgroundColor: colors.borderLight }]} />
          <Pressable
            onPress={handleDismiss}
            accessibilityLabel="Close note editor"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Edit Note</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {changed ? `${originalLabel} → ${pitchLabel}` : `Scanned as ${originalLabel}`}
          </Text>

          <View
            style={[styles.pitchDisplay, { backgroundColor: colors.backgroundSecondary }]}
            accessible
            accessibilityLabel={`New pitch: ${pitchLabel}`}
            accessibilityRole="text"
          >
            <Text style={[styles.pitchText, { color: colors.primary }]} allowFontScaling={false}>
              {pitchLabel}
            </Text>
          </View>

          {!canEdit && (
            <Text style={[styles.cantEdit, { color: colors.error }]}>
              {"This note can't be matched to the score file safely, so it can't be edited."}
            </Text>
          )}

          <StepperRow
            label="Semitone"
            valueLabel="½ step"
            onDown={() => shift(-1)}
            onUp={() => shift(1)}
            downLabel="Down semitone"
            upLabel="Up semitone"
            disabled={!canEdit}
          />
          <StepperRow
            label="Octave"
            valueLabel={`${working.octave}`}
            onDown={() => shift(-12)}
            onUp={() => shift(12)}
            downLabel="Decrease octave"
            upLabel="Increase octave"
            disabled={!canEdit}
          />
        </View>

        <View style={styles.actionRow}>
          <Pressable
            onPress={handleDismiss}
            accessibilityLabel="Cancel"
            accessibilityRole="button"
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.actionBtnText, { color: colors.text }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleApply}
            disabled={!canEdit || !changed}
            accessibilityLabel={`Apply note ${pitchLabel}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canEdit || !changed }}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: colors.primary, opacity: !canEdit || !changed ? 0.4 : pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={[styles.actionBtnText, { color: colors.buttonText }]}>Apply</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

interface StepperRowProps {
  label: string;
  valueLabel: string;
  onDown: () => void;
  onUp: () => void;
  downLabel: string;
  upLabel: string;
  disabled: boolean;
}

function StepperRow({ label, valueLabel, onDown, onUp, downLabel, upLabel, disabled }: StepperRowProps): React.JSX.Element {
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
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: BorderRadius.lg, borderTopRightRadius: BorderRadius.lg,
    paddingBottom: Spacing["2xl"], ...ClayShadow,
  },
  header: { alignItems: "center", paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  handle: { width: 36, height: 4, borderRadius: 2 },
  closeBtn: { position: "absolute", right: Spacing.lg, top: Spacing.sm, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
  title: { fontSize: 16, fontFamily: Fonts.bodyBold, fontWeight: "700", textAlign: "center" },
  subtitle: { fontSize: 13, textAlign: "center" },
  pitchDisplay: { paddingVertical: Spacing.lg, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, alignItems: "center" },
  pitchText: { fontSize: 36, fontFamily: Fonts.bodyBold, fontWeight: "700" },
  cantEdit: { fontSize: 12, textAlign: "center" },
  controlGroup: { gap: Spacing.sm },
  controlLabel: { fontSize: 12, fontFamily: Fonts.bodyBold, fontWeight: "600", marginLeft: Spacing.sm },
  buttonRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.md },
  smallBtn: { width: 44, height: 44, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  buttonLabel: { fontSize: 14, fontFamily: Fonts.bodyBold, fontWeight: "600", minWidth: 40, textAlign: "center" },
  actionRow: { flexDirection: "row", gap: Spacing.md, paddingHorizontal: Spacing.lg, marginTop: Spacing.md },
  actionBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: 50, alignItems: "center" },
  actionBtnText: { fontSize: 14, fontFamily: Fonts.bodyBold, fontWeight: "700" },
});
