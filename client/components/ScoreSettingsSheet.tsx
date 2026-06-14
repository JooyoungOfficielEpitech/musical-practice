import React from "react";
import { StyleSheet, View, Modal, Pressable, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ClayShadow, Fonts, Typography, Colors } from "@/constants/theme";

export interface ScoreSettingsSheetProps {
  visible: boolean;
  onDismiss: () => void;
  editMode: boolean;
  onToggleEdit: () => void;
  hasEdits: boolean;
  instrument: string;
  instrumentLoading: boolean;
  onOpenInstrumentPicker: () => void;
}

function instrumentLabel(instrument: string): string {
  if (instrument === "piano") return "Piano";
  if (instrument === "oscillator") return "Sine Wave";
  return instrument;
}

/** Secondary score settings (note editing, synth instrument) — kept out of the
 *  main browse view so the score and primary actions stay uncluttered. */
export function ScoreSettingsSheet({
  visible, onDismiss, editMode, onToggleEdit, hasEdits,
  instrument, instrumentLoading, onOpenInstrumentPicker,
}: ScoreSettingsSheetProps): React.JSX.Element | null {
  const { colors } = useTheme();
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} accessibilityViewIsModal>
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityLabel="Dismiss" />
      <View testID="score-settings-sheet" style={[styles.sheet, { backgroundColor: colors.surface }]}>
        <View style={styles.header}>
          <View style={[styles.handle, { backgroundColor: colors.borderLight }]} />
          <Text style={[styles.title, { color: colors.text }]}>Score settings</Text>
          <Pressable onPress={onDismiss} accessibilityLabel="Close settings" accessibilityRole="button" hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        <Pressable
          onPress={onToggleEdit}
          accessibilityRole="switch"
          accessibilityState={{ checked: editMode }}
          accessibilityLabel="Edit notes"
          style={({ pressed }) => [styles.row, { borderColor: colors.borderLight, opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="create-outline" size={18} color={editMode ? colors.primary : colors.textSecondary} />
          <Text style={[styles.rowLabel, { color: colors.text }]}>Edit notes</Text>
          {hasEdits && <Text style={[styles.edited, { color: colors.primary }]}>edited</Text>}
          <Ionicons name={editMode ? "toggle" : "toggle-outline"} size={26} color={editMode ? colors.primary : colors.textSecondary} />
        </Pressable>

        <Pressable
          onPress={onOpenInstrumentPicker}
          accessibilityRole="button"
          accessibilityLabel="Change sound"
          style={({ pressed }) => [styles.row, { borderColor: colors.borderLight, opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="musical-note-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.rowLabel, { color: colors.text }]}>Sound</Text>
          <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{instrumentLabel(instrument)}</Text>
          {instrumentLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.light.ripple },
  sheet: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingBottom: Spacing["2xl"],
    paddingHorizontal: Spacing.lg,
    ...ClayShadow,
  },
  header: { alignItems: "center", paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: Spacing.sm },
  title: { fontSize: 16, fontFamily: Fonts.bodySemiBold },
  closeBtn: { position: "absolute", right: 0, top: Spacing.sm, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { ...Typography.body, flex: 1, fontFamily: Fonts.bodySemiBold },
  rowValue: { ...Typography.label },
  edited: { ...Typography.small, fontFamily: Fonts.bodySemiBold },
});
