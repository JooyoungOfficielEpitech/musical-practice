import React from "react";
import { StyleSheet, View, Modal, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Spacing, ClayShadow } from "@/constants/theme";

export interface AudioBottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  audioUrl?: string;
}

export function AudioBottomSheet({
  visible,
  onDismiss,
  audioUrl,
}: AudioBottomSheetProps): React.JSX.Element | null {
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss} />
      <View
        testID="audio-bottom-sheet"
        style={[styles.sheet, { backgroundColor: colors.surface }]}
      >
        <View style={styles.header}>
          <View style={[styles.handle, { backgroundColor: colors.borderLight }]} />
          <Pressable
            onPress={onDismiss}
            accessibilityLabel="Close audio player"
            accessibilityRole="button"
            hitSlop={8}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        {audioUrl ? (
          <AudioPlayer audioUri={audioUrl} />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: Spacing["2xl"],
    paddingHorizontal: Spacing.lg,
    ...ClayShadow,
  },
  header: {
    alignItems: "center",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.sm,
  },
  closeBtn: {
    position: "absolute",
    right: 0,
    top: Spacing.sm,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
