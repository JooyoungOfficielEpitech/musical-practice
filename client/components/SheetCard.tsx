import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";
import type { SheetMusic } from "@/lib/storage";

interface SheetCardProps {
  sheet: SheetMusic;
  onPress: () => void;
  onFavorite?: () => void;
  compact?: boolean;
}

export function SheetCard({ sheet, onPress, onFavorite, compact }: SheetCardProps) {
  const { colors } = useTheme();

  if (compact) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.compactCard,
          { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
          Shadows.md,
        ]}
      >
        <Image source={{ uri: sheet.imageUri }} style={[styles.compactImage, { backgroundColor: colors.backgroundSecondary }]} contentFit="cover" />
        <View style={styles.compactInfo}>
          <Text style={[styles.compactTitle, { color: colors.text }]} numberOfLines={1}>{sheet.title}</Text>
          <Text style={[styles.compactArtist, { color: colors.textSecondary }]} numberOfLines={1}>{sheet.artist}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, opacity: pressed ? 0.95 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        Shadows.lg,
      ]}
    >
      <Image source={{ uri: sheet.imageUri }} style={[styles.image, { backgroundColor: colors.backgroundSecondary }]} contentFit="cover" />
      <View style={styles.info}>
        <View style={styles.textRow}>
          <View style={styles.textCol}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{sheet.title}</Text>
            <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>{sheet.artist}</Text>
          </View>
          {onFavorite && (
            <Pressable onPress={onFavorite} hitSlop={12} style={styles.favBtn}>
              <Ionicons
                name={sheet.isFavorite ? "heart" : "heart-outline"}
                size={22}
                color={sheet.isFavorite ? colors.error : colors.textSecondary}
              />
            </Pressable>
          )}
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="musical-note" size={14} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{sheet.key}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="speedometer-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{sheet.bpm} BPM</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="folder-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{sheet.folder}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.lg, overflow: "hidden" },
  image: { width: "100%", height: 140 },
  info: { padding: Spacing.sm + 6, gap: Spacing.sm + 2 },
  textRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  textCol: { flex: 1, marginRight: Spacing.sm },
  title: { ...Typography.subtitle },
  artist: { ...Typography.small, marginTop: 2 },
  favBtn: { padding: Spacing.xs },
  metaRow: { flexDirection: "row", gap: Spacing.sm + 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  metaText: { ...Typography.label },
  compactCard: { width: 140, borderRadius: BorderRadius.sm, overflow: "hidden" },
  compactImage: { width: "100%", height: 100 },
  compactInfo: { padding: Spacing.sm + 2 },
  compactTitle: { ...Typography.small, fontFamily: "Nunito_600SemiBold", fontWeight: "600" },
  compactArtist: { ...Typography.label, marginTop: 2 },
});
