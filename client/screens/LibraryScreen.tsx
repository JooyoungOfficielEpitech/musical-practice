import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Platform,
  Pressable,
  ActionSheetIOS,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { hapticFeedback } from "@/lib/hapticFeedback";
import { usePractice } from "@/context/PracticeContext";
import { SheetCard } from "@/components/SheetCard";
import { RenameModal } from "@/components/RenameModal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { EmptyState } from "@/components/EmptyState";
import { Spacing, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/types/navigation";
import type { SheetMusic } from "@/lib/storage";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ListSeparator = () => <View style={{ height: Spacing.sm + 6 }} />;

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { sheets, removeSheet, patchSheet } = usePractice();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [renameTarget, setRenameTarget] = useState<SheetMusic | null>(null);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      removeSheet(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, removeSheet]);

  const handleLongPress = useCallback((item: SheetMusic) => {
    void hapticFeedback.triggerMedium();
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: item.title,
          options: ["Rename", "Delete", "Cancel"],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        (index) => {
          if (index === 0) setRenameTarget(item);
          if (index === 1) setDeleteTarget({ id: item.id, title: item.title });
        },
      );
    } else {
      Alert.alert(item.title, undefined, [
        { text: "Rename", onPress: () => setRenameTarget(item) },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => setDeleteTarget({ id: item.id, title: item.title }),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }, []);

  const handleRenameSubmit = useCallback(
    (data: { title: string; artist: string }) => {
      if (renameTarget) {
        void patchSheet(renameTarget.id, data);
        setRenameTarget(null);
      }
    },
    [renameTarget, patchSheet],
  );

  const handleAddPress = useCallback(() => {
    void hapticFeedback.triggerMedium();
    navigation.navigate("PdfImport");
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: SheetMusic }) => (
    <Pressable
      onLongPress={() => handleLongPress(item)}
      delayLongPress={500}
      accessibilityLabel={`Open ${item.title}`}
      accessibilityRole="button"
      accessibilityHint="Long press to rename or delete"
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
    >
      <SheetCard
        sheet={item}
        onPress={() => navigation.navigate("PracticeDetail", { sheetId: item.id })}
      />
    </Pressable>
  ), [navigation, handleLongPress]);

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDefault, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Library</Text>
        <Pressable
          onPress={handleAddPress}
          accessibilityLabel="Import PDF score"
          accessibilityRole="button"
          style={({ pressed }) => [styles.addBtn, { width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
        >
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </Pressable>
      </View>

      <FlatList
        data={sheets}
        keyExtractor={(item) => item.id}
        scrollEnabled={sheets.length > 0}
        contentContainerStyle={[styles.listContent, sheets.length === 0 && { flex: 1 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="musical-notes-outline"
            title="No scores found"
            message="Import a PDF to start practicing"
            actionLabel="Import PDF"
            onAction={() => navigation.navigate("PdfImport")}
          />
        }
        renderItem={renderItem}
        ItemSeparatorComponent={ListSeparator}
        ListFooterComponent={
          sheets.length > 0 ? (
            <Text style={[styles.longPressHint, { color: colors.textSecondary }]}>
              Long press to rename or delete
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

      <RenameModal
        visible={!!renameTarget}
        initialTitle={renameTarget?.title ?? ""}
        initialArtist={renameTarget?.artist}
        onClose={() => setRenameTarget(null)}
        onSubmit={handleRenameSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  title: { ...Typography.h2 },
  addBtn: { padding: Spacing.sm },
  listContent: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
  longPressHint: { ...Typography.label, textAlign: "center", marginTop: Spacing.lg, marginBottom: Spacing.xl },
});
