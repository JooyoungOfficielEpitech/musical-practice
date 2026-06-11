import React, { useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Platform,
  Pressable,
  TextInput,
  ActionSheetIOS,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { usePractice } from "@/context/PracticeContext";
import { SheetCard } from "@/components/SheetCard";
import { SheetFormModal } from "@/components/SheetFormModal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { EmptyState } from "@/components/EmptyState";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/types/navigation";
import { getLastSession } from "@/lib/practiceCardUtils";
import type { SheetMusic } from "@/lib/storage";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const FOLDERS = ["All", "Musical", "Pop", "Classical", "Jazz", "Custom"];

const ListSeparator = () => <View style={{ height: Spacing.sm + 6 }} />;

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { sheets, sessions, removeSheet, toggleFavorite, addSheet } = usePractice();
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState("All");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const filtered = useMemo(() => sheets.filter((s) => {
    const matchFolder = activeFolder === "All" || s.folder === activeFolder;
    const matchSearch =
      !search ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.artist.toLowerCase().includes(search.toLowerCase());
    return matchFolder && matchSearch;
  }), [sheets, activeFolder, search]);

  const handleDeletePress = useCallback((id: string, title: string) => {
    setDeleteTarget({ id, title });
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      removeSheet(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, removeSheet]);

  const handleAddPress = useCallback(() => {
    const options = ["Add Score", "Import PDF", "Cancel"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2, userInterfaceStyle: "dark" },
        (index) => {
          if (index === 0) setShowAddModal(true);
          else if (index === 1) navigation.navigate("PdfImport");
        },
      );
    } else {
      Alert.alert("Add to Library", undefined, [
        { text: "Add Score", onPress: () => setShowAddModal(true) },
        { text: "Import PDF", onPress: () => navigation.navigate("PdfImport") },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: SheetMusic }) => (
    <Pressable
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        handleDeletePress(item.id, item.title);
      }}
      delayLongPress={500}
      accessibilityLabel={`Open ${item.title}`}
      accessibilityRole="button"
      accessibilityHint="Long press to delete"
    >
      <SheetCard
        sheet={item}
        onPress={() => navigation.navigate("PracticeDetail", { sheetId: item.id })}
        onFavorite={() => toggleFavorite(item.id)}
        lastAccuracy={getLastSession(sessions, item.id)?.accuracy}
      />
    </Pressable>
  ), [navigation, sessions, toggleFavorite, handleDeletePress]);

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDefault, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Library</Text>
        <Pressable
          onPress={() => {
            handleAddPress();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          accessibilityLabel="Add new score"
          accessibilityRole="button"
          style={({ pressed }) => [styles.addBtn, { width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.8 : 1 }]}
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
            <Pressable
              onPress={() => setSearch("")}
              accessibilityLabel="Clear search"
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
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
        renderItem={({ item }: { item: string }) => (
          <Pressable
            onPress={() => {
              setActiveFolder(item);
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            accessibilityLabel={`Filter by ${item}`}
            accessibilityRole="button"
            accessibilityState={{ selected: activeFolder === item }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
            message={search ? "Try a different search" : "Import a PDF to start practicing"}
            actionLabel={!search ? "Import PDF" : undefined}
            onAction={!search ? () => navigation.navigate("PdfImport") : undefined}
          />
        }
        renderItem={renderItem}
        ItemSeparatorComponent={ListSeparator}
        ListFooterComponent={
          filtered.length > 0 ? (
            <Text style={[styles.longPressHint, { color: colors.textSecondary }]}>
              Long press a score to delete
            </Text>
          ) : null
        }
      />

      <ConfirmModal
        visible={!!deleteTarget}
        title="Delete Score"
        message={deleteTarget ? `Remove "${deleteTarget.title}" from library?` : ""}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        icon="trash-outline"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <SheetFormModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={(data) => { addSheet(data); setShowAddModal(false); }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  title: { ...Typography.h2 },
  addBtn: { padding: Spacing.sm },
  searchRow: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  searchWrap: { flexDirection: "row", alignItems: "center", borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm + 6, paddingVertical: Spacing.sm + 2, gap: Spacing.sm + 2, borderWidth: 1 },
  searchInput: { flex: 1, ...Typography.body, padding: 0 },
  folderList: { flexGrow: 0, marginBottom: Spacing.sm + 6 },
  folderContent: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  folderChip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: Spacing.xl, borderWidth: 1, minHeight: 44 },
  folderText: { ...Typography.small, fontFamily: "Nunito_500Medium", fontWeight: "500" },
  listContent: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
  longPressHint: { ...Typography.label, textAlign: "center", marginTop: Spacing.lg, marginBottom: Spacing.xl },
});
