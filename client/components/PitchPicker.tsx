import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import { useTheme } from "@/hooks/useTheme";

export interface PitchPickerProps {
  visible: boolean;
  initialPitch: { step: string; alter: number; octave: number } | null;
  onConfirm: (step: string, alter: number, octave: number) => void;
  onDismiss: () => void;
}

interface ChromaticNote {
  label: string;
  step: string;
  alter: number;
}

const CHROMATIC_NOTES: ChromaticNote[] = [
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

const OCTAVES = [2, 3, 4, 5, 6];

export function PitchPicker({
  visible,
  initialPitch,
  onConfirm,
  onDismiss,
}: PitchPickerProps): React.JSX.Element {
  const { colors } = useTheme();

  const [selectedStep, setSelectedStep] = useState(
    initialPitch?.step ?? "C",
  );
  const [selectedAlter, setSelectedAlter] = useState(
    initialPitch?.alter ?? 0,
  );
  const [selectedOctave, setSelectedOctave] = useState(
    initialPitch?.octave ?? 4,
  );

  useEffect(() => {
    if (visible && initialPitch) {
      setSelectedStep(initialPitch.step);
      setSelectedAlter(initialPitch.alter);
      setSelectedOctave(initialPitch.octave);
    }
  }, [visible, initialPitch]);

  if (!visible) return <View />;

  const handleNotePress = (note: ChromaticNote) => {
    setSelectedStep(note.step);
    setSelectedAlter(note.alter);
  };

  const handleConfirm = () => {
    onConfirm(selectedStep, selectedAlter, selectedOctave);
  };

  const isNoteSelected = (note: ChromaticNote) =>
    note.step === selectedStep && note.alter === selectedAlter;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            Select Note
          </Text>

          {/* Chromatic note grid */}
          <View style={styles.noteGrid}>
            {CHROMATIC_NOTES.map((note) => (
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
                onPress={() => handleNotePress(note)}
                accessibilityLabel={note.label}
              >
                <Text
                  style={[
                    styles.noteLabel,
                    { color: isNoteSelected(note) ? "#fff" : colors.text },
                  ]}
                >
                  {note.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Octave selector */}
          <View style={styles.octaveRow}>
            {OCTAVES.map((oct) => (
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
                onPress={() => setSelectedOctave(oct)}
                accessibilityLabel={String(oct)}
              >
                <Text
                  style={[
                    styles.octaveLabel,
                    {
                      color: selectedOctave === oct ? "#fff" : colors.text,
                    },
                  ]}
                >
                  {oct}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.actionButton, { borderColor: colors.border }]}
              onPress={onDismiss}
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
              onPress={handleConfirm}
            >
              <Text style={[styles.actionLabel, { color: "#fff" }]}>
                Confirm
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
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
    height: 40,
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
