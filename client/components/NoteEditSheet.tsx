import React, { useState, useEffect } from "react";
import { StyleSheet, View, Modal, Pressable, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { hapticFeedback } from "@/lib/hapticFeedback";
import { NoteEditStepper } from "@/components/NoteEditStepper";
import { Spacing, BorderRadius, ClayShadow, Fonts } from "@/constants/theme";

export interface NoteEditSheetProps {
  visible: boolean;
  selectedPitch: { step: string; alter: number; octave: number } | null;
  /** Printed lyric of the selected note; null = none. */
  selectedLyric: string | null;
  /** False when the tapped note can't be located safely — editing disabled. */
  canEdit: boolean;
  onApply: (step: string, alter: number, octave: number) => void;
  /** Set/replace/remove (empty string) the selected note's lyric. */
  onApplyLyric: (text: string) => void;
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
// A lyric here is one note's syllable — a hard cap keeps the MusicXML sane.
const LYRIC_MAX_LENGTH = 40;

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
  visible, selectedPitch, selectedLyric, canEdit, onApply, onApplyLyric, onDismiss,
}: NoteEditSheetProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const [workingMidi, setWorkingMidi] = useState(60);
  const [lyricDraft, setLyricDraft] = useState("");

  useEffect(() => {
    if (visible && selectedPitch) {
      setWorkingMidi(pitchToMidi(selectedPitch.step, selectedPitch.alter, selectedPitch.octave));
      setLyricDraft(selectedLyric ?? "");
    }
    // Sync only when a (new) note is selected, not on every keystroke echo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, selectedPitch]);

  if (!visible || !selectedPitch) return null;

  const working = midiToPitch(workingMidi);
  const pitchLabel = pitchLabelOf(working.step, working.alter, working.octave);
  const originalLabel = pitchLabelOf(selectedPitch.step, selectedPitch.alter, selectedPitch.octave);
  const pitchChanged = workingMidi !== pitchToMidi(selectedPitch.step, selectedPitch.alter, selectedPitch.octave);
  const lyricChanged = lyricDraft.trim() !== (selectedLyric ?? "");
  const changed = pitchChanged || lyricChanged;

  const shift = (delta: number) => {
    void hapticFeedback.triggerLight();
    setWorkingMidi((m) => Math.max(MIDI_MIN, Math.min(MIDI_MAX, m + delta)));
  };

  const handleApply = () => {
    if (!canEdit) return;
    void hapticFeedback.triggerMedium();
    // Lyric first: applying the pitch clears the selection in the editor.
    if (lyricChanged) onApplyLyric(lyricDraft);
    if (pitchChanged) {
      onApply(working.step, working.alter, working.octave);
    } else {
      onDismiss();
    }
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
            {pitchChanged ? `${originalLabel} → ${pitchLabel}` : `Scanned as ${originalLabel}`}
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

          <NoteEditStepper
            label="Semitone"
            valueLabel="½ step"
            onDown={() => shift(-1)}
            onUp={() => shift(1)}
            downLabel="Down semitone"
            upLabel="Up semitone"
            disabled={!canEdit}
          />
          <NoteEditStepper
            label="Octave"
            valueLabel={`${working.octave}`}
            onDown={() => shift(-12)}
            onUp={() => shift(12)}
            downLabel="Decrease octave"
            upLabel="Increase octave"
            disabled={!canEdit}
          />

          <View style={styles.lyricLabelRow}>
            <Text style={[styles.lyricLabel, { color: colors.text }]}>Lyric</Text>
            {lyricDraft.length > 0 && (
              <Text style={[styles.lyricCounter, { color: colors.textSecondary }]}>
                {lyricDraft.length}/{LYRIC_MAX_LENGTH}
              </Text>
            )}
          </View>
          <TextInput
            value={lyricDraft}
            onChangeText={setLyricDraft}
            editable={canEdit}
            maxLength={LYRIC_MAX_LENGTH}
            placeholder="No lyric — type to add one"
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="Lyric text"
            style={[styles.lyricInput, { backgroundColor: colors.backgroundSecondary, color: colors.text }]}
          />
        </View>

        <View style={styles.actionRow}>
          <Pressable
            onPress={handleDismiss}
            accessibilityLabel="Cancel"
            accessibilityRole="button"
            android_ripple={{ color: colors.ripple }}
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
            android_ripple={{ color: colors.rippleLight }}
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
  lyricLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginRight: Spacing.sm },
  lyricLabel: { fontSize: 12, fontFamily: Fonts.bodyBold, fontWeight: "600", marginLeft: Spacing.sm },
  lyricCounter: { fontSize: 11 },
  lyricInput: {
    borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: 16, minHeight: 44, textAlign: "center",
  },
  actionRow: { flexDirection: "row", gap: Spacing.md, paddingHorizontal: Spacing.lg, marginTop: Spacing.md },
  actionBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: 50, alignItems: "center", justifyContent: "center", minHeight: 44 },
  actionBtnText: { fontSize: 14, fontFamily: Fonts.bodyBold, fontWeight: "700" },
});
