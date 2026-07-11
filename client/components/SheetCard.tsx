import React, { useCallback } from "react";
import { StyleSheet, Text, View, Pressable, useWindowDimensions, Platform } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { hapticFeedback } from "@/lib/hapticFeedback";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";
import type { SheetMusic } from "@/lib/storage";
import { omrStatusLabel, formatAccuracy, formatImportDate } from "@/lib/practiceCardUtils";
import { ProgressTrack } from "@/components/ProgressTrack";

/** Sheet-music styled stand-in shown until the score's preview image arrives. */
function ScoreCoverPlaceholder({ height }: { height: number }) {
  const { colors } = useTheme();
  const staffLines = [0.3, 0.4, 0.5, 0.6, 0.7];
  return (
    <View style={[styles.image, styles.imagePlaceholder, { backgroundColor: colors.backgroundSecondary, height }]}>
      {staffLines.map((pos) => (
        <View
          key={pos}
          style={[
            styles.staffLine,
            { top: height * pos, backgroundColor: colors.borderLight },
          ]}
        />
      ))}
      <Ionicons name="musical-notes-outline" size={40} color={colors.textSecondary} />
    </View>
  );
}

interface SheetCardProps {
  sheet: SheetMusic;
  onPress: () => void;
  onFavorite?: () => void;
  compact?: boolean;
  lastAccuracy?: number;
}

function SheetCardComponent({ sheet, onPress, onFavorite, compact, lastAccuracy }: SheetCardProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const imageHeight = isTablet ? 200 : 140;
  const compactCardWidth = isTablet ? 180 : 140;
  const compactImageHeight = isTablet ? 130 : 100;

  const handleCardPress = useCallback(() => {
    void hapticFeedback.triggerLight();
    onPress();
  }, [onPress]);

  const handleFavoritePress = useCallback(() => {
    void hapticFeedback.triggerMedium();
    onFavorite?.();
  }, [onFavorite]);

  if (compact) {
    return (
      <Pressable
        onPress={handleCardPress}
        accessibilityLabel={`${sheet.title} by ${sheet.artist}`}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.compactCard,
          { backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }], width: compactCardWidth },
          Shadows.md,
        ]}
      >
        {sheet.imageUris[0] ? (
          <Image source={{ uri: sheet.imageUris[0] }} style={[styles.compactImage, { backgroundColor: colors.backgroundSecondary, width: compactCardWidth, height: compactImageHeight }]} contentFit="cover" />
        ) : (
          <View style={[styles.compactImage, styles.imagePlaceholder, { backgroundColor: colors.backgroundSecondary, width: compactCardWidth, height: compactImageHeight }]}>
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
      onPress={handleCardPress}
      accessibilityLabel={`${sheet.title} by ${sheet.artist}`}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, opacity: pressed ? 0.95 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        Shadows.lg,
      ]}
    >
      <View
        accessible={true}
        accessibilityLabel={`${sheet.title}, ${sheet.imageUris.length} page${sheet.imageUris.length !== 1 ? "s" : ""}${sheet.audioUri ? ", audio available" : ""}${(() => { const omr = omrStatusLabel(sheet.omrStatus ?? "none"); return omr ? `, ${omr.label}` : ""; })()}`}
      >
        {sheet.imageUris[0] ? (
          <Image source={{ uri: sheet.imageUris[0] }} style={[styles.image, { backgroundColor: colors.backgroundSecondary, height: imageHeight }]} contentFit="cover" contentPosition="top" />
        ) : (
          <ScoreCoverPlaceholder height={imageHeight} />
        )}
        {sheet.imageUris.length > 1 && (
          <View style={[styles.pagesBadge, { backgroundColor: colors.accent }]} accessible={false}>
            <Text style={[styles.pagesBadgeText, { color: colors.buttonText }]}>{sheet.imageUris.length}</Text>
          </View>
        )}
        {sheet.audioUri && (
          <View style={[styles.audioBadge, { backgroundColor: colors.primary }]} accessible={false}>
            <Ionicons name="musical-note" size={10} color={colors.buttonText} />
          </View>
        )}
        {(() => {
          const omr = omrStatusLabel(sheet.omrStatus ?? "none");
          if (!omr) return null;
          const bgColor =
            omr.variant === "ready"
              ? colors.primary
              : omr.variant === "processing"
              ? colors.accent
              : colors.error;
          const label =
            omr.variant === "processing"
              ? `Scanning ${sheet.omrProgress ?? 0}%`
              : omr.label;
          return (
            <View testID="omr-badge" style={[styles.omrBadge, { backgroundColor: bgColor }]} accessible={false}>
              <Text style={[styles.omrBadgeText, { color: colors.buttonText }]}>{label}</Text>
            </View>
          );
        })()}
        {sheet.omrStatus === "processing" && (
          <View style={styles.progressOverlay} accessible={false}>
            <ProgressTrack percent={sheet.omrProgress ?? 0} height={3} />
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
              onPress={handleFavoritePress}
              accessibilityLabel={sheet.isFavorite ? "Remove from favorites" : "Add to favorites"}
              accessibilityRole="button"
              hitSlop={16}
              style={[styles.favBtn, { minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }]}
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
            <Ionicons name="calendar-clear-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatImportDate(sheet.createdAt)}</Text>
          </View>
          {formatAccuracy(lastAccuracy) !== null && (
            <View style={styles.metaItem}>
              <Ionicons name="checkmark-circle-outline" size={14} color={colors.textSecondary} />
              <Text testID="accuracy-chip" style={[styles.metaText, { color: colors.textSecondary }]}>
                {formatAccuracy(lastAccuracy)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export const SheetCard = React.memo(SheetCardComponent);

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
  imagePlaceholder: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  staffLine: { position: "absolute", left: Spacing.xl, right: Spacing.xl, height: 1 },
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
  omrBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  omrBadgeText: { ...Typography.label, fontSize: 10, fontFamily: "Nunito_700Bold", fontWeight: "700" },
  progressOverlay: { position: "absolute", bottom: 0, left: 0, right: 0 },
});
