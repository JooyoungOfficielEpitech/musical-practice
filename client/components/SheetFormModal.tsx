import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  Platform,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { SheetMusic } from "@/lib/storage";

export interface SheetFormData {
  title: string;
  artist: string;
  folder: string;
  imageUris: string[];
  audioUri?: string;
}

interface SheetFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: SheetFormData) => void;
  initialData?: SheetMusic;
}

const FOLDERS = ["Musical", "Pop", "Classical", "Jazz", "Custom"];

export function SheetFormModal({ visible, onClose, onSubmit, initialData }: SheetFormModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const isEdit = !!initialData;

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [folder, setFolder] = useState("Musical");
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [audioUri, setAudioUri] = useState("");
  const [errors, setErrors] = useState<{ title?: string; images?: string }>({});
  const [showCameraSettings, setShowCameraSettings] = useState(false);

  // Reset form when modal opens with new data
  useEffect(() => {
    if (visible) {
      if (initialData) {
        setTitle(initialData.title);
        setArtist(initialData.artist);
        setFolder(initialData.folder);
        setImageUris(initialData.imageUris);
        setAudioUri(initialData.audioUri || "");
      } else {
        setTitle("");
        setArtist("");
        setFolder("Musical");
        setImageUris([]);
        setAudioUri("");
      }
      setErrors({});
    }
  }, [visible, initialData]);

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setImageUris((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
      if (errors.images) setErrors((prev) => ({ ...prev, images: undefined }));
    }
  }, [errors.images]);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        setShowCameraSettings(true);
      }
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setImageUris((prev) => [...prev, result.assets[0].uri]);
      if (errors.images) setErrors((prev) => ({ ...prev, images: undefined }));
    }
  }, [errors.images]);

  const removeImage = useCallback((index: number) => {
    setImageUris((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const pickAudio = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      setAudioUri(result.assets[0].uri);
    }
  }, []);

  const removeAudio = useCallback(() => {
    setAudioUri("");
  }, []);

  const handleSubmit = () => {
    const newErrors: { title?: string; images?: string } = {};
    if (!title.trim()) {
      newErrors.title = "Please enter a title.";
    }
    if (imageUris.length === 0) {
      newErrors.images = "Please select at least one image.";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onSubmit({
      title: title.trim(),
      artist: artist.trim() || "Unknown",
      folder,
      imageUris,
      audioUri: audioUri || undefined,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing.xl }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {isEdit ? "Edit Score" : "Add Score"}
              </Text>
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
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Title *</Text>
              <TextInput
                style={[
                  styles.formInput,
                  { backgroundColor: colors.backgroundDefault, color: colors.text, borderColor: errors.title ? colors.error : colors.borderLight },
                ]}
                placeholder="e.g. Les Mis\u00e9rables - On My Own"
                placeholderTextColor={colors.textSecondary}
                value={title}
                onChangeText={(t) => {
                  setTitle(t);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                }}
              />
              {errors.title && (
                <Text style={[styles.errorText, { color: colors.error }]}>{errors.title}</Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Artist</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.backgroundDefault, color: colors.text, borderColor: colors.borderLight }]}
                placeholder="e.g. Claude-Michel Sch\u00f6nberg"
                placeholderTextColor={colors.textSecondary}
                value={artist}
                onChangeText={setArtist}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Folder</Text>
              <View style={styles.folderRow}>
                {FOLDERS.map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => setFolder(f)}
                    accessibilityLabel={`Folder ${f}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: folder === f }}
                    style={[
                      styles.folderChip,
                      { backgroundColor: colors.surface, borderColor: colors.borderLight },
                      folder === f && { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
                    ]}
                  >
                    <Text style={[styles.folderText, { color: colors.textSecondary }, folder === f && { color: colors.buttonText }]}>{f}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Sheet Music Image *</Text>
              <View style={styles.imagePickRow}>
                <Pressable
                  onPress={pickImage}
                  accessibilityLabel="Pick image from gallery"
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.imagePickBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primarySubtle, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Ionicons name="images-outline" size={20} color={colors.primary} />
                  <Text style={[styles.imagePickText, { color: colors.primary }]}>Gallery</Text>
                </Pressable>
                <Pressable
                  onPress={takePhoto}
                  accessibilityLabel="Take photo with camera"
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.imagePickBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primarySubtle, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Ionicons name="camera-outline" size={20} color={colors.primary} />
                  <Text style={[styles.imagePickText, { color: colors.primary }]}>Camera</Text>
                </Pressable>
              </View>
              {imageUris.length > 0 && (
                <View style={styles.thumbnailRow}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {imageUris.map((uri, i) => (
                      <View key={`${uri}-${i}`} style={styles.thumbnailWrap}>
                        <Image source={{ uri }} style={styles.thumbnail} contentFit="cover" />
                        <Pressable
                          onPress={() => removeImage(i)}
                          style={[styles.thumbnailRemove, { backgroundColor: colors.error }]}
                          accessibilityLabel={`Remove image ${i + 1}`}
                        >
                          <Ionicons name="close" size={14} color={colors.buttonText} />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                  <Text style={[styles.imageCountText, { color: colors.textSecondary }]}>
                    {imageUris.length === 1 ? "1 image" : `${imageUris.length} images`}
                  </Text>
                </View>
              )}
              {errors.images && (
                <Text style={[styles.errorText, { color: colors.error }]}>{errors.images}</Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>MR / Backing Track</Text>
              {audioUri ? (
                <View style={styles.audioExisting}>
                  <View style={styles.audioInfo}>
                    <Ionicons name="musical-notes" size={18} color={colors.success} />
                    <Text style={[styles.audioText, { color: colors.success }]} numberOfLines={1}>
                      Audio attached
                    </Text>
                  </View>
                  <View style={styles.audioActions}>
                    <Pressable
                      onPress={pickAudio}
                      accessibilityLabel="Change audio file"
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.audioActionBtn, { backgroundColor: colors.primaryLight, opacity: pressed ? 0.8 : 1 }]}
                    >
                      <Text style={[styles.audioActionText, { color: colors.primary }]}>Change</Text>
                    </Pressable>
                    <Pressable
                      onPress={removeAudio}
                      accessibilityLabel="Remove audio"
                      style={({ pressed }) => [styles.audioRemoveBtn, { opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Ionicons name="close-circle" size={22} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={pickAudio}
                  accessibilityLabel="Select audio file"
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.imagePickBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primarySubtle, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Ionicons name="musical-notes-outline" size={20} color={colors.primary} />
                  <Text style={[styles.imagePickText, { color: colors.primary }]}>Select MP3</Text>
                </Pressable>
              )}
            </View>

            <Pressable
              onPress={handleSubmit}
              accessibilityLabel={isEdit ? "Save changes" : "Add to library"}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: colors.primaryDark, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <Text style={[styles.saveBtnText, { color: colors.buttonText }]}>
                {isEdit ? "Save Changes" : "Add to Library"}
              </Text>
            </Pressable>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={showCameraSettings}
        title="Camera Access Required"
        message="Camera permission was denied. Please enable it in Settings."
        confirmLabel="Open Settings"
        cancelLabel="Cancel"
        icon="camera-outline"
        onConfirm={() => {
          setShowCameraSettings(false);
          Linking.openSettings();
        }}
        onCancel={() => setShowCameraSettings(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: { flex: 1 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: BorderRadius.lg, borderTopRightRadius: BorderRadius.lg, padding: Spacing.xl, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.xl },
  modalTitle: { ...Typography.title },
  formGroup: { marginBottom: Spacing.lg },
  formLabel: { ...Typography.small, fontFamily: "Nunito_500Medium", fontWeight: "500", marginBottom: 6 },
  formInput: { borderRadius: Spacing.sm + 2, paddingHorizontal: Spacing.sm + 6, paddingVertical: Spacing.md, ...Typography.body, borderWidth: 1 },
  folderRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  folderChip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Spacing.xl, borderWidth: 1 },
  folderText: { ...Typography.small, fontFamily: "Nunito_500Medium", fontWeight: "500" },
  imagePickRow: { flexDirection: "row", gap: Spacing.md },
  imagePickBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, borderRadius: Spacing.sm + 2, paddingVertical: Spacing.md, borderWidth: 1 },
  imagePickText: { ...Typography.body, fontFamily: "Nunito_500Medium", fontWeight: "500" },
  thumbnailRow: { marginTop: Spacing.sm + 4, gap: Spacing.xs },
  thumbnailWrap: { width: 68, height: 68, marginRight: Spacing.sm, position: "relative", paddingTop: 8, paddingRight: 8 },
  thumbnail: { width: 60, height: 60, borderRadius: BorderRadius.xs },
  thumbnailRemove: { position: "absolute", top: 0, right: 0, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", zIndex: 1 },
  imageCountText: { ...Typography.label, marginTop: 2 },
  audioExisting: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Spacing.sm + 2 },
  audioInfo: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, flex: 1 },
  audioText: { ...Typography.body, fontFamily: "Nunito_500Medium", fontWeight: "500" },
  audioActions: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  audioActionBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.xs },
  audioActionText: { ...Typography.label, fontFamily: "Nunito_600SemiBold", fontWeight: "600" },
  audioRemoveBtn: { padding: 2 },
  saveBtn: { borderRadius: BorderRadius.sm, paddingVertical: Spacing.lg, alignItems: "center", marginTop: Spacing.sm },
  saveBtnText: { ...Typography.subtitle },
  errorText: { ...Typography.small, marginTop: Spacing.xs },
});
