import React, { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import { useTheme } from "@/hooks/useTheme";

interface ChromaticNote {
  label: string;
  step: string;
  alter: number;
}

export const CHROMATIC_NOTES: ChromaticNote[] = [
  { label: "C", step: "C", alter: 0 },
  { label: "C#", step: "C", alter: 1 },
  { label: "D", step: "D", alter: 0 },
  { label: "D#", step: "D", alter: 1 },
  { label: "E", step: "E", alter: 0 },
  { label: "F", step: "F", alter: 0 },
  { label: "F#", step: "F", alter: 1 },
  { label: "G", step: "G", alter: 0 },
  { label: "G#", step: "G", alter: 1 },
  { label: "A", step: "A", alter: 0 },
  { label: "A#", step: "A", alter: 1 },
  { label: "B", step: "B", alter: 0 },
];

export const OCTAVES = [2, 3, 4, 5, 6];

interface NoteGridProps {
  selectedStep: string;
  selectedAlter: number;
  onNotePress: (note: ChromaticNote) => void;
}

export const NoteGrid = React.memo(function NoteGrid({
  selectedStep,
  selectedAlter,
  onNotePress,
}: NoteGridProps): React.JSX.Element {
  const { colors } = useTheme();

  const isNoteSelected = useCallback(
    (note: ChromaticNote) =>
      note.step === selectedStep && note.alter === selectedAlter,
    [selectedStep, selectedAlter],
  );

  const renderNote = useCallback(
    (note: ChromaticNote) => (
      <Pressable
        key={note.label}
        style={[
          styles.noteButton,
          { borderColor: colors.border },
          isNoteSelected(note) && {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
          },
        ]}
        onPress={() => onNotePress(note)}
        accessibilityLabel={note.label}
        accessibilityRole="button"
        accessibilityState={{ selected: isNoteSelected(note) }}
      >
        <Text
          style={[
            styles.noteLabel,
            {
              color: isNoteSelected(note)
                ? colors.buttonText
                : colors.text,
            },
          ]}
        >
          {note.label}
        </Text>
      </Pressable>
    ),
    [isNoteSelected, onNotePress, colors],
  );

  return (
    <View style={styles.noteGrid}>
      {CHROMATIC_NOTES.map(renderNote)}
    </View>
  );
});

interface OctaveSelectorProps {
  selectedOctave: number;
  onOctavePress: (octave: number) => void;
}

export const OctaveSelector = React.memo(function OctaveSelector({
  selectedOctave,
  onOctavePress,
}: OctaveSelectorProps): React.JSX.Element {
  const { colors } = useTheme();

  const renderOctave = useCallback(
    (oct: number) => (
      <Pressable
        key={oct}
        style={[
          styles.octaveButton,
          { borderColor: colors.border },
          selectedOctave === oct && {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
          },
        ]}
        onPress={() => onOctavePress(oct)}
        accessibilityLabel={String(oct)}
        accessibilityRole="button"
        accessibilityState={{ selected: selectedOctave === oct }}
      >
        <Text
          style={[
            styles.octaveLabel,
            {
              color: selectedOctave === oct
                ? colors.buttonText
                : colors.text,
            },
          ]}
        >
          {oct}
        </Text>
      </Pressable>
    ),
    [selectedOctave, onOctavePress, colors],
  );

  return (
    <View style={styles.octaveRow}>
      {OCTAVES.map(renderOctave)}
    </View>
  );
});

interface ActionButtonsProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export const ActionButtons = React.memo(function ActionButtons({
  onCancel,
  onConfirm,
}: ActionButtonsProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View style={styles.actions}>
      <Pressable
        style={[styles.actionButton, { borderColor: colors.border }]}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel pitch selection"
      >
        <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>
          Cancel
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.actionButton,
          { backgroundColor: colors.primary, borderColor: colors.primary },
        ]}
        onPress={onConfirm}
        accessibilityRole="button"
        accessibilityLabel="Confirm pitch selection"
      >
        <Text style={[styles.actionLabel, { color: colors.buttonText }]}>
          Confirm
        </Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  noteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  noteButton: {
    width: 52,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  noteLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  octaveRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  octaveButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  octaveLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
});
