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
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePractice } from "@/lib/practice-context";
import { SheetCard } from "@/components/SheetCard";
import { EmptyState } from "@/components/EmptyState";

const FOLDERS = ["All", "Musical", "Pop", "Classical", "Jazz", "Custom"];
const KEYS = ["C", "D", "E", "F", "G", "A", "B"];

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
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
        Alert.alert(
          "Camera Access Required",
          "Camera permission was denied. Please enable it in Settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ],
        );
      } else {
        Alert.alert("Permission needed", "Camera permission is required to take photos.");
      }
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
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
      {
        text: "Delete",
        style: "destructive",
        onPress: () => removeSheet(id),
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
        <Pressable
          onPress={() => setShowAdd(true)}
          style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="add-circle" size={28} color={Colors.light.primary} />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={Colors.light.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search scores..."
            placeholderTextColor={Colors.light.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
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
              activeFolder === item && styles.folderChipActive,
            ]}
          >
            <Text
              style={[
                styles.folderText,
                activeFolder === item && styles.folderTextActive,
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
          <Pressable
            onLongPress={() => handleDelete(item.id, item.title)}
            delayLongPress={500}
          >
            <SheetCard
              sheet={item}
              onPress={() =>
                router.push({
                  pathname: "/practice-detail",
                  params: { sheetId: item.id },
                })
              }
              onFavorite={() => toggleFavorite(item.id)}
            />
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      />

      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Score</Text>
              <Pressable onPress={() => setShowAdd(false)}>
                <Ionicons name="close" size={24} color={Colors.light.text} />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Les Misérables - On My Own"
                placeholderTextColor={Colors.light.textTertiary}
                value={newTitle}
                onChangeText={setNewTitle}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Artist</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Claude-Michel Schönberg"
                placeholderTextColor={Colors.light.textTertiary}
                value={newArtist}
                onChangeText={setNewArtist}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>BPM</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="120"
                  placeholderTextColor={Colors.light.textTertiary}
                  value={newBpm}
                  onChangeText={setNewBpm}
                  keyboardType="number-pad"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Key</Text>
                <View style={styles.keyRow}>
                  {KEYS.map((k) => (
                    <Pressable
                      key={k}
                      onPress={() => setNewKey(k)}
                      style={[styles.keyChip, newKey === k && styles.keyChipActive]}
                    >
                      <Text style={[styles.keyText, newKey === k && styles.keyTextActive]}>
                        {k}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Folder</Text>
              <View style={styles.keyRow}>
                {FOLDERS.filter((f) => f !== "All").map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => setNewFolder(f)}
                    style={[styles.folderChip, newFolder === f && styles.folderChipActive]}
                  >
                    <Text style={[styles.folderText, newFolder === f && styles.folderTextActive]}>
                      {f}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Sheet Music Image *</Text>
              <View style={styles.imagePickRow}>
                <Pressable
                  onPress={pickImage}
                  style={({ pressed }) => [styles.imagePickBtn, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <Ionicons name="images-outline" size={20} color={Colors.light.primary} />
                  <Text style={styles.imagePickText}>Gallery</Text>
                </Pressable>
                <Pressable
                  onPress={takePhoto}
                  style={({ pressed }) => [styles.imagePickBtn, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <Ionicons name="camera-outline" size={20} color={Colors.light.primary} />
                  <Text style={styles.imagePickText}>Camera</Text>
                </Pressable>
              </View>
              {!!newImageUri && (
                <View style={styles.imageSelected}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.light.success} />
                  <Text style={styles.imageSelectedText}>Image selected</Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={handleAdd}
              style={({ pressed }) => [
                styles.saveBtn,
                { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <Text style={styles.saveBtnText}>Add to Library</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  addBtn: {
    padding: 4,
  },
  searchRow: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    padding: 0,
  },
  folderList: {
    flexGrow: 0,
    marginBottom: 14,
  },
  folderContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  folderChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  folderChipActive: {
    backgroundColor: Colors.light.primaryDark,
    borderColor: Colors.light.primaryDark,
  },
  folderText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  folderTextActive: {
    color: Colors.light.primaryText,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "web" ? 34 : 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.light.overlay,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
  },
  keyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  keyChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.surfaceSecondary,
  },
  keyChipActive: {
    backgroundColor: Colors.light.primaryDark,
  },
  keyText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary,
  },
  keyTextActive: {
    color: Colors.light.primaryText,
  },
  imagePickRow: {
    flexDirection: "row",
    gap: 12,
  },
  imagePickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primary + "14",
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.light.primary + "30",
  },
  imagePickText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.primary,
  },
  imageSelected: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  imageSelectedText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.success,
  },
  saveBtn: {
    backgroundColor: Colors.light.primaryDark,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primaryText,
  },
});
