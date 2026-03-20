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
        accessibilityLabel={`${sheet.title} by ${sheet.artist}`}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.compactCard,
          { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
          Shadows.md,
        ]}
      >
        {sheet.imageUris[0] ? (
          <Image source={{ uri: sheet.imageUris[0] }} style={[styles.compactImage, { backgroundColor: colors.backgroundSecondary }]} contentFit="cover" />
        ) : (
          <View style={[styles.compactImage, styles.imagePlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
            <Ionicons name="musical-notes-outline" size={28} color={colors.textSecondary} />
          </View>
        )}
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
      accessibilityLabel={`${sheet.title} by ${sheet.artist}`}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, opacity: pressed ? 0.95 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        Shadows.lg,
      ]}
    >
      <View>
        {sheet.imageUris[0] ? (
          <Image source={{ uri: sheet.imageUris[0] }} style={[styles.image, { backgroundColor: colors.backgroundSecondary }]} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
            <Ionicons name="musical-notes-outline" size={40} color={colors.textSecondary} />
          </View>
        )}
        {sheet.imageUris.length > 1 && (
          <View style={[styles.pagesBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.pagesBadgeText, { color: colors.buttonText }]}>{sheet.imageUris.length}</Text>
          </View>
        )}
        {sheet.audioUri && (
          <View style={[styles.audioBadge, { backgroundColor: colors.primary }]}>
            <Ionicons name="musical-note" size={10} color={colors.buttonText} />
          </View>
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.textRow}>
          <View style={styles.textCol}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{sheet.title}</Text>
            <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>{sheet.artist}</Text>
          </View>
          {onFavorite && (
            <Pressable
              onPress={onFavorite}
              accessibilityLabel={sheet.isFavorite ? "Remove from favorites" : "Add to favorites"}
              accessibilityRole="button"
              hitSlop={12}
              style={styles.favBtn}
            >
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
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  pagesBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  pagesBadgeText: { ...Typography.label, fontSize: 11, fontFamily: "Nunito_700Bold", fontWeight: "700" },
  audioBadge: {
    position: "absolute",
    top: 8,
    right: 36,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
});
