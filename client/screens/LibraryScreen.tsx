import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  Platform,
  Modal,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { usePractice } from "@/context/PracticeContext";
import { SheetCard } from "@/components/SheetCard";
import { EmptyState } from "@/components/EmptyState";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/types/navigation";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const FOLDERS = ["All", "Musical", "Pop", "Classical", "Jazz", "Custom"];
const KEYS = ["C", "D", "E", "F", "G", "A", "B"];

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { sheets, addSheet, removeSheet, toggleFavorite } = usePractice();
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newArtist, setNewArtist] = useState("");
  const [newBpm, setNewBpm] = useState("120");
  const [newKey, setNewKey] = useState("C");
  const [newFolder, setNewFolder] = useState("Musical");
  const [newImageUri, setNewImageUri] = useState("");

  const filtered = sheets.filter((s) => {
    const matchFolder = activeFolder === "All" || s.folder === activeFolder;
    const matchSearch =
      !search ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.artist.toLowerCase().includes(search.toLowerCase());
    return matchFolder && matchSearch;
  });

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setNewImageUri(result.assets[0].uri);
    }
  }, []);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        Alert.alert("Camera Access Required", "Camera permission was denied. Please enable it in Settings.", [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]);
      } else {
        Alert.alert("Permission needed", "Camera permission is required to take photos.");
      }
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setNewImageUri(result.assets[0].uri);
    }
  }, []);

  const handleAdd = async () => {
    if (!newTitle.trim()) {
      Alert.alert("Required", "Please enter a title.");
      return;
    }
    if (!newImageUri) {
      Alert.alert("Required", "Please select a sheet music image.");
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    await addSheet({
      title: newTitle.trim(),
      artist: newArtist.trim() || "Unknown",
      imageUri: newImageUri,
      bpm: parseInt(newBpm) || 120,
      key: newKey,
      folder: newFolder,
    });
    setShowAdd(false);
    setNewTitle("");
    setNewArtist("");
    setNewBpm("120");
    setNewKey("C");
    setNewFolder("Musical");
    setNewImageUri("");
  };

  const handleDelete = (id: string, title: string) => {
    Alert.alert("Delete Score", `Remove "${title}" from library?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeSheet(id) },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDefault, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Library</Text>
        <Pressable
          onPress={() => setShowAdd(true)}
          style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search scores..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={FOLDERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.folderList}
        contentContainerStyle={styles.folderContent}
        scrollEnabled={FOLDERS.length > 0}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              setActiveFolder(item);
              if (Platform.OS !== "web") Haptics.selectionAsync();
            }}
            style={[
              styles.folderChip,
              { backgroundColor: colors.surface, borderColor: colors.borderLight },
              activeFolder === item && { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
            ]}
          >
            <Text
              style={[
                styles.folderText,
                { color: colors.textSecondary },
                activeFolder === item && { color: colors.buttonText },
              ]}
            >
              {item}
            </Text>
          </Pressable>
        )}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        scrollEnabled={filtered.length > 0}
        contentContainerStyle={[styles.listContent, filtered.length === 0 && { flex: 1 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="musical-notes-outline"
            title="No scores found"
            message={search ? "Try a different search" : "Add your first sheet music"}
            actionLabel={!search ? "Add Score" : undefined}
            onAction={!search ? () => setShowAdd(true) : undefined}
          />
        }
        renderItem={({ item }) => (
          <Pressable onLongPress={() => handleDelete(item.id, item.title)} delayLongPress={500}>
            <SheetCard
              sheet={item}
              onPress={() => navigation.navigate("PracticeDetail", { sheetId: item.id })}
              onFavorite={() => toggleFavorite(item.id)}
            />
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm + 6 }} />}
      />

      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing.xl }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Score</Text>
              <Pressable onPress={() => setShowAdd(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Title *</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.backgroundDefault, color: colors.text, borderColor: colors.borderLight }]}
                placeholder="e.g. Les Mis\u00e9rables - On My Own"
                placeholderTextColor={colors.textSecondary}
                value={newTitle}
                onChangeText={setNewTitle}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Artist</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.backgroundDefault, color: colors.text, borderColor: colors.borderLight }]}
                placeholder="e.g. Claude-Michel Sch\u00f6nberg"
                placeholderTextColor={colors.textSecondary}
                value={newArtist}
                onChangeText={setNewArtist}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>BPM</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.backgroundDefault, color: colors.text, borderColor: colors.borderLight }]}
                  placeholder="120"
                  placeholderTextColor={colors.textSecondary}
                  value={newBpm}
                  onChangeText={setNewBpm}
                  keyboardType="number-pad"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Key</Text>
                <View style={styles.keyRow}>
                  {KEYS.map((k) => (
                    <Pressable
                      key={k}
                      onPress={() => setNewKey(k)}
                      style={[
                        styles.keyChip,
                        { backgroundColor: colors.backgroundSecondary },
                        newKey === k && { backgroundColor: colors.primaryDark },
                      ]}
                    >
                      <Text style={[styles.keyText, { color: colors.textSecondary }, newKey === k && { color: colors.buttonText }]}>{k}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Folder</Text>
              <View style={styles.keyRow}>
                {FOLDERS.filter((f) => f !== "All").map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => setNewFolder(f)}
                    style={[
                      styles.folderChip,
                      { backgroundColor: colors.surface, borderColor: colors.borderLight },
                      newFolder === f && { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
                    ]}
                  >
                    <Text style={[styles.folderText, { color: colors.textSecondary }, newFolder === f && { color: colors.buttonText }]}>{f}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Sheet Music Image *</Text>
              <View style={styles.imagePickRow}>
                <Pressable
                  onPress={pickImage}
                  style={({ pressed }) => [styles.imagePickBtn, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "30", opacity: pressed ? 0.8 : 1 }]}
                >
                  <Ionicons name="images-outline" size={20} color={colors.primary} />
                  <Text style={[styles.imagePickText, { color: colors.primary }]}>Gallery</Text>
                </Pressable>
                <Pressable
                  onPress={takePhoto}
                  style={({ pressed }) => [styles.imagePickBtn, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "30", opacity: pressed ? 0.8 : 1 }]}
                >
                  <Ionicons name="camera-outline" size={20} color={colors.primary} />
                  <Text style={[styles.imagePickText, { color: colors.primary }]}>Camera</Text>
                </Pressable>
              </View>
              {!!newImageUri && (
                <View style={styles.imageSelected}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={[styles.imageSelectedText, { color: colors.success }]}>Image selected</Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={handleAdd}
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: colors.primaryDark, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <Text style={[styles.saveBtnText, { color: colors.buttonText }]}>Add to Library</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  title: { ...Typography.h2 },
  addBtn: { padding: Spacing.xs },
  searchRow: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  searchWrap: { flexDirection: "row", alignItems: "center", borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm + 6, paddingVertical: Spacing.sm + 2, gap: Spacing.sm + 2, borderWidth: 1 },
  searchInput: { flex: 1, ...Typography.body, padding: 0 },
  folderList: { flexGrow: 0, marginBottom: Spacing.sm + 6 },
  folderContent: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  folderChip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Spacing.xl, borderWidth: 1 },
  folderText: { ...Typography.small, fontFamily: "Nunito_500Medium", fontWeight: "500" },
  listContent: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: BorderRadius.lg, borderTopRightRadius: BorderRadius.lg, padding: Spacing.xl, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.xl },
  modalTitle: { ...Typography.title },
  formGroup: { marginBottom: Spacing.lg },
  formLabel: { ...Typography.small, fontFamily: "Nunito_500Medium", fontWeight: "500", marginBottom: 6 },
  formInput: { borderRadius: Spacing.sm + 2, paddingHorizontal: Spacing.sm + 6, paddingVertical: Spacing.md, ...Typography.body, borderWidth: 1 },
  formRow: { flexDirection: "row", gap: Spacing.md },
  keyRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  keyChip: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  keyText: { ...Typography.small, fontFamily: "Nunito_600SemiBold", fontWeight: "600" },
  imagePickRow: { flexDirection: "row", gap: Spacing.md },
  imagePickBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, borderRadius: Spacing.sm + 2, paddingVertical: Spacing.md, borderWidth: 1 },
  imagePickText: { ...Typography.body, fontFamily: "Nunito_500Medium", fontWeight: "500" },
  imageSelected: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: Spacing.sm },
  imageSelectedText: { ...Typography.small },
  saveBtn: { borderRadius: BorderRadius.sm, paddingVertical: Spacing.lg, alignItems: "center", marginTop: Spacing.sm },
  saveBtnText: { ...Typography.subtitle },
});
