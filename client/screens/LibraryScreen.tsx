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
import type { SheetMusic } from "@/lib/storage";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ListSeparator = () => <View style={{ height: Spacing.sm + 6 }} />;

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { sheets, removeSheet, addSheet } = usePractice();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

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
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Import PDF", "Cancel"], cancelButtonIndex: 1, userInterfaceStyle: "dark" },
        (index) => {
          if (index === 0) navigation.navigate("PdfImport");
        },
      );
    } else {
      Alert.alert("Import Score", undefined, [
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
      />
    </Pressable>
  ), [navigation, handleDeletePress]);

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
  listContent: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
  longPressHint: { ...Typography.label, textAlign: "center", marginTop: Spacing.lg, marginBottom: Spacing.xl },
});
