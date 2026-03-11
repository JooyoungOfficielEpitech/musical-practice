import React from "react";
import { StyleSheet, Text, View, Pressable, Platform } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import type { SheetMusic } from "@/lib/storage";

interface SheetCardProps {
  sheet: SheetMusic;
  onPress: () => void;
  onFavorite?: () => void;
  compact?: boolean;
}

export function SheetCard({ sheet, onPress, onFavorite, compact }: SheetCardProps) {
  if (compact) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.compactCard,
          { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        ]}
      >
        <Image source={{ uri: sheet.imageUri }} style={styles.compactImage} contentFit="cover" />
        <View style={styles.compactInfo}>
          <Text style={styles.compactTitle} numberOfLines={1}>{sheet.title}</Text>
          <Text style={styles.compactArtist} numberOfLines={1}>{sheet.artist}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { opacity: pressed ? 0.95 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <Image source={{ uri: sheet.imageUri }} style={styles.image} contentFit="cover" />
      <View style={styles.info}>
        <View style={styles.textRow}>
          <View style={styles.textCol}>
            <Text style={styles.title} numberOfLines={1}>{sheet.title}</Text>
            <Text style={styles.artist} numberOfLines={1}>{sheet.artist}</Text>
          </View>
          {onFavorite && (
            <Pressable onPress={onFavorite} hitSlop={12} style={styles.favBtn}>
              <Ionicons
                name={sheet.isFavorite ? "heart" : "heart-outline"}
                size={22}
                color={sheet.isFavorite ? Colors.light.error : Colors.light.textTertiary}
              />
            </Pressable>
          )}
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="musical-note" size={14} color={Colors.light.textTertiary} />
            <Text style={styles.metaText}>{sheet.key}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="speedometer-outline" size={14} color={Colors.light.textTertiary} />
            <Text style={styles.metaText}>{sheet.bpm} BPM</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="folder-outline" size={14} color={Colors.light.textTertiary} />
            <Text style={styles.metaText}>{sheet.folder}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.cardShadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
      default: {
        shadowColor: Colors.light.cardShadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
    }),
  },
  image: {
    width: "100%",
    height: 140,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  info: {
    padding: 14,
    gap: 10,
  },
  textRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  textCol: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  artist: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  favBtn: {
    padding: 4,
  },
  metaRow: {
    flexDirection: "row",
    gap: 14,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary,
  },
  compactCard: {
    width: 140,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.cardShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {
        shadowColor: Colors.light.cardShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
    }),
  },
  compactImage: {
    width: "100%",
    height: 100,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  compactInfo: {
    padding: 10,
  },
  compactTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  compactArtist: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
});
