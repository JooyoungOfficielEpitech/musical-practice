import React from "react";
import { StyleSheet, View, Modal, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { hapticFeedback } from "@/lib/hapticFeedback";
import { PartCheckCard } from "@/components/PartCheckCard";
import { Spacing, BorderRadius, ClayShadow, Fonts } from "@/constants/theme";
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
}: PartCheckSheetProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} accessibilityViewIsModal>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onDismiss}
        accessibilityLabel="Dismiss"
      />
      <SafeAreaView testID="part-check-sheet" style={[styles.sheet, { backgroundColor: colors.surface }]} edges={["bottom"]}>
        <View style={styles.header}>
          <View style={[styles.handle, { backgroundColor: colors.borderLight }]} />
          <Pressable onPress={onDismiss} accessibilityLabel="Close parts" accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.closeBtn}>
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
          onPress={() => {
            void hapticFeedback.triggerMedium();
            onDismiss();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.doneBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
        >
          <Text style={[styles.doneText, { color: colors.buttonText }]}>Done</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingBottom: Spacing["2xl"],
    ...ClayShadow,
  },
  header: { alignItems: "center", paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  handle: { width: 36, height: 4, borderRadius: 2 },
  closeBtn: { position: "absolute", right: Spacing.lg, top: Spacing.sm, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  doneBtn: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 50,
    alignItems: "center",
  },
  doneText: { fontSize: 16, fontFamily: Fonts.bodyBold, fontWeight: "700" },
});
