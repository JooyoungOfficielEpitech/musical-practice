import React, { useState, useCallback } from "react";
import { StyleSheet, Text, View, FlatList, Pressable, TextInput, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { AudioPlayer } from "@/components/AudioPlayer";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { Recording } from "@/lib/audio/types";

interface RecordingsListProps {
  recordings: Recording[];
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RecordingsList({ recordings, onDelete, onRename }: RecordingsListProps) {
  const { colors } = useTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Recording | null>(null);
  const [renameTarget, setRenameTarget] = useState<Recording | null>(null);
  const [renameText, setRenameText] = useState("");

  const handleDeletePress = useCallback((recording: Recording) => {
    setDeleteTarget(recording);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      onDelete(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, onDelete]);

  const handleRenamePress = useCallback((recording: Recording) => {
    setRenameText(recording.title);
    setRenameTarget(recording);
  }, []);

  const handleRenameSubmit = useCallback(() => {
    if (renameTarget && renameText.trim()) {
      onRename(renameTarget.id, renameText.trim());
      setRenameTarget(null);
    }
  }, [renameTarget, renameText, onRename]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (recordings.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="mic-off-outline" size={32} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No recordings yet
        </Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={recordings}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={[styles.item, { backgroundColor: colors.surface }]}>
            <Pressable
              onPress={() => toggleExpand(item.id)}
              accessibilityLabel={`Recording: ${item.title}, ${formatDuration(item.duration)}`}
              accessibilityRole="button"
              style={styles.itemHeader}
            >
              <Ionicons
                name={expandedId === item.id ? "mic" : "mic-outline"}
                size={20}
                color={colors.primary}
              />
              <View style={styles.itemInfo}>
                <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
                  {formatDuration(item.duration)} · {formatFileSize(item.fileSize)}
                </Text>
              </View>
              <Pressable
                onPress={() => handleRenamePress(item)}
                accessibilityLabel="Rename recording"
                accessibilityRole="button"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.5 : 1 }]}
              >
                <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => handleDeletePress(item)}
                accessibilityLabel="Delete recording"
                accessibilityRole="button"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.5 : 1 }]}
              >
                <Ionicons name="trash-outline" size={16} color={colors.error} />
              </Pressable>
            </Pressable>
            {expandedId === item.id && (
              <View style={styles.playerWrap}>
                <AudioPlayer audioUri={item.fileUri} />
              </View>
            )}
          </View>
        )}
      />

      {/* Delete Confirm Modal */}
      <ConfirmModal
        visible={!!deleteTarget}
        title="Delete Recording"
        message={deleteTarget ? `Delete "${deleteTarget.title}"? (${formatDuration(deleteTarget.duration)})` : ""}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        icon="trash-outline"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Rename Modal */}
      <Modal visible={!!renameTarget} transparent animationType="fade">
        <View style={[styles.renameOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.renameCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.renameTitle, { color: colors.text }]}>Rename Recording</Text>
            <TextInput
              style={[
                styles.renameInput,
                { backgroundColor: colors.backgroundDefault, color: colors.text, borderColor: colors.borderLight },
              ]}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
              placeholder="Recording name"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
              onSubmitEditing={handleRenameSubmit}
            />
            <View style={styles.renameActions}>
              <Pressable
                onPress={() => setRenameTarget(null)}
                accessibilityLabel="Cancel rename"
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.renameBtn,
                  { backgroundColor: colors.backgroundTertiary, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={[styles.renameBtnText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleRenameSubmit}
                accessibilityLabel="Save new name"
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.renameBtn,
                  { backgroundColor: colors.primaryDark, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Text style={[styles.renameBtnText, { color: colors.buttonText }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    gap: Spacing.sm,
  },
  emptyText: {
    ...Typography.body,
  },
  item: {
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    ...Typography.body,
    fontFamily: "Nunito_500Medium",
    fontWeight: "500",
  },
  itemMeta: {
    ...Typography.label,
    marginTop: 2,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  playerWrap: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  // Rename modal
  renameOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing["3xl"],
  },
  renameCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
  },
  renameTitle: {
    ...Typography.subtitle,
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  renameInput: {
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.body,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  renameActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  renameBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    minHeight: 48,
  },
  renameBtnText: {
    ...Typography.subtitle,
  },
});
