import React, { useState } from "react";
import { reloadAppAsync } from "expo";
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Text,
  Modal,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

export type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
};

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleRestart = async () => {
    try {
      await reloadAppAsync();
    } catch {
      resetError();
    }
  };

  const monoFont = Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDefault }]}>
      {__DEV__ ? (
        <Pressable
          onPress={() => setIsModalVisible(true)}
          style={({ pressed }) => [
            styles.topButton,
            {
              top: insets.top + Spacing.lg,
              backgroundColor: colors.backgroundSecondary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="alert-circle" size={20} color={colors.text} />
        </Pressable>
      ) : null}

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Something went wrong</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          Please reload the app to continue.
        </Text>
        <Pressable
          onPress={handleRestart}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.buttonText }]}>Try Again</Text>
        </Pressable>
      </View>

      {__DEV__ ? (
        <Modal
          visible={isModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: colors.backgroundDefault }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Error Details</Text>
                <Pressable onPress={() => setIsModalVisible(false)} style={styles.closeButton}>
                  <Feather name="x" size={24} color={colors.text} />
                </Pressable>
              </View>
              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={[styles.modalScrollContent, { paddingBottom: insets.bottom + Spacing.lg }]}
              >
                <View style={[styles.errorContainer, { backgroundColor: colors.backgroundSecondary }]}>
                  <Text
                    style={[styles.errorText, { color: colors.text, fontFamily: monoFont }]}
                    selectable
                  >
                    {`Error: ${error.message}\n\n${error.stack ?? ""}`}
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: Spacing["2xl"] },
  content: { alignItems: "center", gap: Spacing.lg, maxWidth: 600 },
  title: { fontSize: 28, fontWeight: "700", textAlign: "center" },
  message: { fontSize: 16, textAlign: "center", lineHeight: 24 },
  topButton: {
    position: "absolute",
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  button: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing["2xl"],
    minWidth: 200,
  },
  buttonText: { fontWeight: "600", textAlign: "center", fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContainer: { width: "100%", height: "90%", borderTopLeftRadius: BorderRadius.lg, borderTopRightRadius: BorderRadius.lg },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 20, fontWeight: "600" },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  modalScrollView: { flex: 1 },
  modalScrollContent: { padding: Spacing.lg },
  errorContainer: { borderRadius: BorderRadius.xs, padding: Spacing.lg },
  errorText: { fontSize: 12, lineHeight: 18 },
});
