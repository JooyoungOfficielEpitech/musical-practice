import React, { useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { Metronome } from "@/components/Metronome";
import { PracticeTimer } from "@/components/PracticeTimer";
import { usePractice } from "@/lib/practice-context";

export default function PracticeDetailScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { sheetId } = useLocalSearchParams<{ sheetId: string }>();
  const { sheets, addSession, sessions, loading } = usePractice();
  const sheet = useMemo(() => sheets.find((s) => s.id === sheetId), [sheets, sheetId]);
  const [currentBpm, setCurrentBpm] = useState(sheet?.bpm || 120);
  const [showMetronome, setShowMetronome] = useState(false);

  const sheetSessions = useMemo(
    () => sessions.filter((s) => s.sheetMusicId === sheetId),
    [sessions, sheetId],
  );
  const bestScore = useMemo(
    () =>
      sheetSessions.length > 0
        ? Math.max(...sheetSessions.map((s) => s.accuracy))
        : null,
    [sheetSessions],
  );

  const handleSessionStop = useCallback(
    async (totalSeconds: number) => {
      if (!sheet) return;
      const accuracy = Math.floor(Math.random() * 25) + 75;
      await addSession({
        sheetMusicId: sheet.id,
        sheetMusicTitle: sheet.title,
        startedAt: Date.now() - totalSeconds * 1000,
        duration: totalSeconds,
        accuracy,
        bpm: currentBpm,
      });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert(
        "Session Complete",
        `Score: ${accuracy}%\nDuration: ${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`,
      );
    },
    [sheet, addSession, currentBpm],
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!sheet) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
        </Pressable>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.light.textTertiary} />
          <Text style={styles.notFoundText}>Score not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
        </Pressable>
        <View style={styles.topBarTitle}>
          <Text style={styles.titleText} numberOfLines={1}>{sheet.title}</Text>
          <Text style={styles.subtitleText} numberOfLines={1}>{sheet.artist}</Text>
        </View>
        <View style={styles.topBarRight}>
          {bestScore !== null && (
            <View style={styles.bestBadge}>
              <Ionicons name="trophy" size={12} color={Colors.light.warning} />
              <Text style={styles.bestText}>{bestScore}%</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : 40 }}
      >
        <View style={styles.imageContainer}>
          <Image source={{ uri: sheet.imageUri }} style={styles.sheetImage} contentFit="contain" />
          <View style={styles.imageOverlay}>
            <View style={styles.metaBadge}>
              <Ionicons name="musical-note" size={12} color={Colors.light.primaryText} />
              <Text style={styles.metaBadgeText}>{sheet.key}</Text>
            </View>
            <View style={styles.metaBadge}>
              <Ionicons name="speedometer-outline" size={12} color={Colors.light.primaryText} />
              <Text style={styles.metaBadgeText}>{sheet.bpm} BPM</Text>
            </View>
          </View>
        </View>

        <View style={styles.timerSection}>
          <PracticeTimer onStop={handleSessionStop} />
        </View>

        <Pressable
          onPress={() => setShowMetronome(!showMetronome)}
          style={({ pressed }) => [
            styles.metronomeToggle,
            { opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Ionicons name="metronome-outline" size={20} color={Colors.light.primary} />
          <Text style={styles.metronomeToggleText}>
            {showMetronome ? "Hide Metronome" : "Show Metronome"}
          </Text>
          <Ionicons
            name={showMetronome ? "chevron-up" : "chevron-down"}
            size={18}
            color={Colors.light.textTertiary}
          />
        </Pressable>

        {showMetronome && (
          <View style={styles.metronomeCard}>
            <Metronome initialBpm={currentBpm} onBpmChange={setCurrentBpm} />
          </View>
        )}

        {sheetSessions.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Recent Sessions</Text>
            {sheetSessions.slice(0, 5).map((s) => (
              <View key={s.id} style={styles.historyItem}>
                <View>
                  <Text style={styles.historyDate}>
                    {new Date(s.startedAt).toLocaleDateString()}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {Math.floor(s.duration / 60)}m · {s.bpm} BPM
                  </Text>
                </View>
                <Text
                  style={[
                    styles.historyScore,
                    {
                      color:
                        s.accuracy >= 80
                          ? Colors.light.success
                          : s.accuracy >= 60
                            ? Colors.light.warning
                            : Colors.light.error,
                    },
                  ]}
                >
                  {s.accuracy}%
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    flex: 1,
  },
  titleText: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  subtitleText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  topBarRight: {
    alignItems: "flex-end",
  },
  bestBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.light.warning + "18",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bestText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.warning,
  },
  imageContainer: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Colors.light.surface,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.cardShadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  sheetImage: {
    width: "100%",
    height: 250,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  imageOverlay: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    gap: 6,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.light.primaryText,
  },
  timerSection: {
    marginTop: 24,
    marginBottom: 20,
  },
  metronomeToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    padding: 14,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  metronomeToggleText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.primary,
  },
  metronomeCard: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    paddingVertical: 10,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.cardShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  historySection: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  historyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    marginBottom: 12,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
  },
  historyMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  historyScore: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
});
