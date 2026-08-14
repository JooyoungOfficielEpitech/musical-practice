import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Platform,
  Pressable,
  ActionSheetIOS,
  Alert,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { hapticFeedback } from "@/lib/hapticFeedback";
import { usePractice } from "@/context/PracticeContext";
import { buildRetryPatch } from "@/lib/omrRetry";
import { getLibraryStats, getLastAccuracyBySheet } from "@/lib/practiceSessionRecorder";
import { LibraryStatsStrip } from "@/components/LibraryStatsStrip";
import { SheetCard } from "@/components/SheetCard";
import { RenameModal } from "@/components/RenameModal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { EmptyState } from "@/components/EmptyState";
import { Spacing, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/types/navigation";
import type { SheetMusic, UserStats } from "@/lib/storage";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ListSeparator = () => <View style={{ height: Spacing.sm + 6 }} />;

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { sheets, removeSheet, patchSheet, refreshData } = usePractice();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [renameTarget, setRenameTarget] = useState<SheetMusic | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [accuracyBySheet, setAccuracyBySheet] = useState<Record<string, number>>({});

  const loadStats = useCallback(() => {
    getLibraryStats().then(setStats).catch(() => {});
    getLastAccuracyBySheet().then(setAccuracyBySheet).catch(() => {});
  }, []);
  // Sessions are recorded when leaving the practice screen, so refresh the
  // strip every time the library regains focus.
  useEffect(() => {
    loadStats();
    const unsubscribe = navigation.addListener("focus", loadStats);
    return unsubscribe;
  }, [navigation, loadStats]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshData();
      loadStats();
    } finally {
      setRefreshing(false);
    }
  }, [refreshData, loadStats]);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      removeSheet(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, removeSheet]);

  const handleRetryScan = useCallback(
    async (item: SheetMusic) => {
      try {
        const patch = await buildRetryPatch(item);
        await patchSheet(item.id, patch);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not restart the scan.";
        Alert.alert("Retry failed", message);
      }
    },
    [patchSheet],
  );

  const handleLongPress = useCallback((item: SheetMusic) => {
    void hapticFeedback.triggerMedium();
    const canRetry = item.omrStatus === "failed" && !!item.omrJobId;
    if (Platform.OS === "ios") {
      const options = canRetry
        ? ["Retry Scan", "Rename", "Delete", "Cancel"]
        : ["Rename", "Delete", "Cancel"];
      const offset = canRetry ? 1 : 0;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: item.title,
          options,
          destructiveButtonIndex: offset + 1,
          cancelButtonIndex: offset + 2,
        },
        (index) => {
          if (canRetry && index === 0) void handleRetryScan(item);
          if (index === offset) setRenameTarget(item);
          if (index === offset + 1) setDeleteTarget({ id: item.id, title: item.title });
        },
      );
    } else {
      Alert.alert(item.title, undefined, [
        ...(canRetry
          ? [{ text: "Retry Scan", onPress: () => void handleRetryScan(item) }]
          : []),
        { text: "Rename", onPress: () => setRenameTarget(item) },
        {
          text: "Delete",
          style: "destructive" as const,
          onPress: () => setDeleteTarget({ id: item.id, title: item.title }),
        },
        { text: "Cancel", style: "cancel" as const },
      ]);
    }
  }, [handleRetryScan]);

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
    <SheetCard
      sheet={item}
      lastAccuracy={accuracyBySheet[item.id]}
      onPress={() => navigation.navigate("PracticeDetail", { sheetId: item.id })}
      onLongPress={() => handleLongPress(item)}
    />
  ), [navigation, handleLongPress, accuracyBySheet]);

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDefault, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Library</Text>
        <Pressable
          onPress={handleAddPress}
          accessibilityLabel="Import PDF score"
          accessibilityRole="button"
          android_ripple={{ color: colors.ripple, borderless: true }}
          style={({ pressed }) => [styles.addBtn, { width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
        >
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </Pressable>
      </View>

      <FlatList
        data={sheets}
        keyExtractor={(item) => item.id}
        alwaysBounceVertical
        contentContainerStyle={[styles.listContent, sheets.length === 0 && { flex: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.textSecondary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
        ListHeaderComponent={stats ? <LibraryStatsStrip stats={stats} /> : null}
        ListEmptyComponent={
          <EmptyState
            icon="musical-notes-outline"
            title="Start with a PDF score"
            message={
              "Import sheet music and we'll scan it into playable parts.\n" +
              "Scanning runs in the background and usually takes a few minutes — " +
              "you can keep using the app (or close it) while it works."
            }
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
