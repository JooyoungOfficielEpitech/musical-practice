import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import {
  getAvailableInstruments,
  downloadInstrument,
  deleteInstrument,
  type InstrumentMeta,
} from "@/lib/audio/instrumentManager";

interface InstrumentPickerProps {
  visible: boolean;
  selectedInstrumentId: string;
  onSelect: (instrumentId: string) => void;
  onClose: () => void;
}

export function InstrumentPicker({
  visible,
  selectedInstrumentId,
  onSelect,
  onClose,
}: InstrumentPickerProps) {
  const { colors } = useTheme();
  const [instruments, setInstruments] = useState<InstrumentMeta[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    if (visible) {
      setInstruments(getAvailableInstruments());
    }
  }, [visible]);

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    setDownloadProgress(0);
    try {
      await downloadInstrument(id, (progress) => setDownloadProgress(progress));
      setInstruments(getAvailableInstruments());
    } catch (err) {
      console.warn("Download failed:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = (id: string) => {
    deleteInstrument(id);
    setInstruments(getAvailableInstruments());
    // If the deleted instrument was selected, fall back to piano
    if (selectedInstrumentId === id) {
      onSelect("piano");
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "Built-in";
    if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(0)} KB`;
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  };

  const renderItem = ({ item }: { item: InstrumentMeta }) => {
    const isSelected = item.id === selectedInstrumentId;
    const isDownloading = downloadingId === item.id;
    const canUse = item.isBuiltin || item.isDownloaded;

    return (
      <Pressable
        onPress={() => {
          if (canUse) {
            onSelect(item.id);
            onClose();
          }
        }}
        accessibilityLabel={`${item.name}${isSelected ? ", selected" : ""}`}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.instrumentRow,
          {
            backgroundColor: isSelected ? colors.primaryLight : colors.card,
            borderColor: isSelected ? colors.primary : colors.border,
            opacity: pressed && canUse ? 0.8 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: isSelected
                ? colors.primarySubtle
                : colors.backgroundTertiary,
            },
          ]}
        >
          <Ionicons
            name={item.icon as keyof typeof Ionicons.glyphMap}
            size={22}
            color={isSelected ? colors.primary : colors.textSecondary}
          />
        </View>

        <View style={styles.instrumentInfo}>
          <Text
            style={[
              styles.instrumentName,
              { color: isSelected ? colors.primary : colors.text },
            ]}
          >
            {item.name}
          </Text>
          <Text style={[styles.instrumentMeta, { color: colors.textSecondary }]}>
            {formatSize(item.sizeBytes)}
            {item.sampleCount > 0 ? ` · ${item.sampleCount} samples` : ""}
          </Text>
        </View>

        <View style={styles.actionArea}>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
          )}
          {!item.isBuiltin && !item.isDownloaded && !isDownloading && (
            <Pressable
              onPress={() => handleDownload(item.id)}
              accessibilityLabel={`Download ${item.name}`}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Ionicons
                name="cloud-download-outline"
                size={24}
                color={item.downloadUrl ? colors.primary : colors.textSecondary}
              />
            </Pressable>
          )}
          {isDownloading && (
            <ActivityIndicator size="small" color={colors.primary} />
          )}
          {!item.isBuiltin && item.isDownloaded && !isSelected && (
            <Pressable
              onPress={() => handleDelete(item.id)}
              accessibilityLabel={`Delete ${item.name}`}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </Pressable>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.backgroundDefault },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              Instrument
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close"
              accessibilityRole="button"
              hitSlop={8}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <FlatList
            data={instruments}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "70%",
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingBottom: Spacing["4xl"],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    ...Typography.title,
  },
  list: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  instrumentRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  instrumentInfo: {
    flex: 1,
  },
  instrumentName: {
    ...Typography.subtitle,
  },
  instrumentMeta: {
    ...Typography.small,
    marginTop: 2,
  },
  actionArea: {
    marginLeft: Spacing.sm,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
