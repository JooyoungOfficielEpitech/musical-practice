import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
} from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Colors } from "@/constants/theme";
import {
  NoteGrid,
  OctaveSelector,
  ActionButtons,
} from "./PitchPickerComponents";

export interface PitchPickerProps {
  visible: boolean;
  initialPitch: { step: string; alter: number; octave: number } | null;
  onConfirm: (step: string, alter: number, octave: number) => void;
  onDismiss: () => void;
}

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

  const handleNotePress = (note: { step: string; alter: number }) => {
    setSelectedStep(note.step);
    setSelectedAlter(note.alter);
  };

  const handleConfirm = () => {
    onConfirm(selectedStep, selectedAlter, selectedOctave);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      accessibilityViewIsModal={true}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            Select Note
          </Text>

          <NoteGrid
            selectedStep={selectedStep}
            selectedAlter={selectedAlter}
            onNotePress={handleNotePress}
          />

          <OctaveSelector
            selectedOctave={selectedOctave}
            onOctavePress={setSelectedOctave}
          />

          <ActionButtons
            onCancel={onDismiss}
            onConfirm={handleConfirm}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: Colors.light.overlay,
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
});
