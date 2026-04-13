import React from "react";
import { StyleSheet, Text, View, Pressable, Modal, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  icon,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const cardMaxWidth = width >= 768 ? 480 : 320;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.surface, maxWidth: cardMaxWidth }]}>
          {icon && (
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: destructive ? colors.errorLight : colors.primaryLight },
              ]}
            >
              <Ionicons
                name={icon}
                size={28}
                color={destructive ? colors.error : colors.primary}
              />
            </View>
          )}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              accessibilityLabel={cancelLabel}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.btn,
                styles.cancelBtn,
                { backgroundColor: colors.backgroundTertiary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: colors.text }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              accessibilityLabel={confirmLabel}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.btn,
                styles.confirmBtn,
                {
                  backgroundColor: destructive ? colors.error : colors.primaryDark,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Text style={[styles.btnText, { color: colors.buttonText }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing["3xl"],
  },
  card: {
    width: "100%",
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: "center",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.subtitle,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  message: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
    width: "100%",
  },
  btn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  cancelBtn: {},
  confirmBtn: {},
  btnText: {
    ...Typography.subtitle,
  },
});
