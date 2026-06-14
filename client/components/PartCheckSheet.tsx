import React from "react";
import { StyleSheet, View, Modal, Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { PartCheckCard } from "@/components/PartCheckCard";
import { Spacing, BorderRadius, ClayShadow, Fonts, Colors } from "@/constants/theme";
import type { PartInfo } from "@/types/music";

export interface PartCheckSheetProps {
  visible: boolean;
  onDismiss: () => void;
  parts: PartInfo[];
  partNoteCounts: Record<string, number>;
  visiblePartIds: Set<string>;
  onTogglePart: (partId: string) => void;
}

/** Bottom sheet that surfaces the full part-check UI (parts + note counts +
 *  selection) on demand, so the browse screen can stay compact. */
export function PartCheckSheet({
  visible,
  onDismiss,
  parts,
  partNoteCounts,
  visiblePartIds,
  onTogglePart,
}: PartCheckSheetProps): React.JSX.Element | null {
  const { colors } = useTheme();
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} accessibilityViewIsModal>
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityLabel="Dismiss" />
      <View testID="part-check-sheet" style={[styles.sheet, { backgroundColor: colors.surface }]}>
        <View style={styles.header}>
          <View style={[styles.handle, { backgroundColor: colors.borderLight }]} />
          <Pressable onPress={onDismiss} accessibilityLabel="Close parts" accessibilityRole="button" hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        <PartCheckCard
          parts={parts}
          partNoteCounts={partNoteCounts}
          visiblePartIds={visiblePartIds}
          onTogglePart={onTogglePart}
        />
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          style={({ pressed }) => [styles.doneBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}
        >
          <Text style={[styles.doneText, { color: colors.buttonText }]}>Done</Text>
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
    ...ClayShadow,
  },
  header: { alignItems: "center", paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  handle: { width: 36, height: 4, borderRadius: 2 },
  closeBtn: { position: "absolute", right: Spacing.lg, top: Spacing.sm, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  doneBtn: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 50,
    alignItems: "center",
  },
  doneText: { fontSize: 16, fontFamily: Fonts.bodyBold, fontWeight: "700" },
});
