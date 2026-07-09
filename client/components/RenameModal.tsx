import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { hapticFeedback } from "@/lib/hapticFeedback";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

export interface RenameData {
  title: string;
  artist: string;
}

interface RenameModalProps {
  visible: boolean;
  initialTitle: string;
  initialArtist?: string;
  onClose: () => void;
  onSubmit: (data: RenameData) => void;
}

export function RenameModal({ visible, initialTitle, initialArtist, onClose, onSubmit }: RenameModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [title, setTitle] = useState(initialTitle);
  const [artist, setArtist] = useState(initialArtist ?? "");
  const [titleError, setTitleError] = useState(false);
  const titleInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setArtist(initialArtist ?? "");
      setTitleError(false);
      // Focus after the modal animation settles
      const id = setTimeout(() => titleInputRef.current?.focus(), 350);
      return () => clearTimeout(id);
    }
  }, [visible, initialTitle, initialArtist]);

  const handleSubmit = () => {
    if (!title.trim()) {
      setTitleError(true);
      return;
    }
    void hapticFeedback.triggerLight();
    onSubmit({ title: title.trim(), artist: artist.trim() });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.content, { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing.xl }]}>
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Rename Score</Text>
              <Pressable
                onPress={onClose}
                accessibilityLabel="Close"
                accessibilityRole="button"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
              <TextInput
                ref={titleInputRef}
                style={[
                  styles.input,
                  { backgroundColor: colors.backgroundDefault, color: colors.text, borderColor: titleError ? colors.error : colors.borderLight },
                ]}
                placeholder="Score title"
                placeholderTextColor={colors.textSecondary}
                value={title}
                onChangeText={(t) => {
                  setTitle(t);
                  if (titleError) setTitleError(false);
                }}
                returnKeyType="next"
                accessibilityLabel="Score title"
              />
              {titleError && (
                <Text style={[styles.errorText, { color: colors.error }]}>Please enter a title.</Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Artist (optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundDefault, color: colors.text, borderColor: colors.borderLight }]}
                placeholder="Artist or composer"
                placeholderTextColor={colors.textSecondary}
                value={artist}
                onChangeText={setArtist}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                accessibilityLabel="Artist"
              />
            </View>

            <Pressable
              onPress={handleSubmit}
              accessibilityLabel="Save"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: colors.primaryDark, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <Text style={[styles.saveBtnText, { color: colors.buttonText }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: { flex: 1 },
  overlay: { flex: 1, justifyContent: "flex-end" },
  content: { borderTopLeftRadius: BorderRadius.lg, borderTopRightRadius: BorderRadius.lg, padding: Spacing.xl },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.xl },
  headerTitle: { ...Typography.title },
  formGroup: { marginBottom: Spacing.lg },
  label: { ...Typography.small, fontFamily: "Nunito_500Medium", fontWeight: "500", marginBottom: 6 },
  input: { borderRadius: Spacing.sm + 2, paddingHorizontal: Spacing.sm + 6, paddingVertical: Spacing.md, ...Typography.body, borderWidth: 1 },
  saveBtn: { borderRadius: BorderRadius.sm, paddingVertical: Spacing.lg, alignItems: "center", marginTop: Spacing.sm },
  saveBtnText: { ...Typography.subtitle },
  errorText: { ...Typography.small, marginTop: Spacing.xs },
});
