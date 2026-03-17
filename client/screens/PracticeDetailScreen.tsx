import React, { useState, useCallback, useMemo, useEffect } from "react";
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
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";
import { Metronome } from "@/components/Metronome";
import { PracticeTimer } from "@/components/PracticeTimer";
import { PitchDisplay } from "@/components/PitchDisplay";
import { CentsIndicator } from "@/components/CentsIndicator";
import { usePractice } from "@/context/PracticeContext";
import { usePitchDetection } from "@/hooks/usePitchDetection";
import { usePitchAccuracy } from "@/hooks/usePitchAccuracy";
import { useAudioPermission } from "@/hooks/useAudioPermission";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";
import type { RootStackParamList } from "@/types/navigation";

type PracticeDetailRouteProp = RouteProp<RootStackParamList, "PracticeDetail">;

export default function PracticeDetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<PracticeDetailRouteProp>();
  const { sheetId } = route.params;
  const { sheets, addSession, sessions, loading } = usePractice();
  const sheet = useMemo(() => sheets.find((s) => s.id === sheetId), [sheets, sheetId]);
  const [currentBpm, setCurrentBpm] = useState(sheet?.bpm || 120);
  const [showMetronome, setShowMetronome] = useState(false);

  const { isListening, currentPitch, error: pitchError, startListening, stopListening } = usePitchDetection();
  const { sessionAccuracy, addReading, reset: resetAccuracy } = usePitchAccuracy();
  const { isGranted, requestPermission } = useAudioPermission();

  // Feed pitch readings into accuracy tracker
  useEffect(() => {
    if (currentPitch) {
      addReading(currentPitch);
    }
  }, [currentPitch, addReading]);

  const handlePitchToggle = useCallback(async () => {
    if (isListening) {
      stopListening();
    } else {
      if (!isGranted) {
        const granted = await requestPermission();
        if (!granted) return;
      }
      resetAccuracy();
      await startListening();
    }
  }, [isListening, isGranted, requestPermission, startListening, stopListening, resetAccuracy]);

  const handleTimerStart = useCallback(async () => {
    if (!isGranted) {
      const granted = await requestPermission();
      if (!granted) return;
    }
    resetAccuracy();
    await startListening();
  }, [isGranted, requestPermission, resetAccuracy, startListening]);

  const sheetSessions = useMemo(
    () => sessions.filter((s) => s.sheetMusicId === sheetId),
    [sessions, sheetId],
  );
  const bestScore = useMemo(
    () => sheetSessions.length > 0 ? Math.max(...sheetSessions.map((s) => s.accuracy)) : null,
    [sheetSessions],
  );

  const handleSessionStop = useCallback(
    async (totalSeconds: number) => {
      if (!sheet) return;
      stopListening();
      const accuracy = sessionAccuracy > 0 ? sessionAccuracy : 0;
      await addSession({
        sheetMusicId: sheet.id,
        sheetMusicTitle: sheet.title,
        startedAt: Date.now() - totalSeconds * 1000,
        duration: totalSeconds,
        accuracy,
        bpm: currentBpm,
      });
      resetAccuracy();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Session Complete", `Score: ${accuracy}%\nDuration: ${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`);
    },
    [sheet, addSession, currentBpm, sessionAccuracy, stopListening, resetAccuracy],
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundDefault, paddingTop: insets.top }]}>
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!sheet) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundDefault, paddingTop: insets.top }]}>
        <Pressable onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.surface }]}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>Score not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDefault, paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.topBarTitle}>
          <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>{sheet.title}</Text>
          <Text style={[styles.subtitleText, { color: colors.textSecondary }]} numberOfLines={1}>{sheet.artist}</Text>
        </View>
        <View style={styles.topBarRight}>
          {bestScore !== null && (
            <View style={[styles.bestBadge, { backgroundColor: colors.warning + "18" }]}>
              <Ionicons name="trophy" size={12} color={colors.warning} />
              <Text style={[styles.bestText, { color: colors.warning }]}>{bestScore}%</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[styles.imageContainer, { backgroundColor: colors.surface }, Shadows.lg]}>
          <Image source={{ uri: sheet.imageUri }} style={[styles.sheetImage, { backgroundColor: colors.backgroundSecondary }]} contentFit="contain" />
          <View style={styles.imageOverlay}>
            <View style={styles.metaBadge}>
              <Ionicons name="musical-note" size={12} color={colors.buttonText} />
              <Text style={[styles.metaBadgeText, { color: colors.buttonText }]}>{sheet.key}</Text>
            </View>
            <View style={styles.metaBadge}>
              <Ionicons name="speedometer-outline" size={12} color={colors.buttonText} />
              <Text style={[styles.metaBadgeText, { color: colors.buttonText }]}>{sheet.bpm} BPM</Text>
            </View>
          </View>
        </View>

        <View style={styles.timerSection}>
          <PracticeTimer onStop={handleSessionStop} onStart={handleTimerStart} />
        </View>

        <View style={[styles.pitchSection, { backgroundColor: colors.surface }, Shadows.md]}>
          <PitchDisplay
            isListening={isListening}
            currentPitch={currentPitch}
            accuracy={sessionAccuracy}
            onToggle={handlePitchToggle}
            error={pitchError}
          />
          {isListening && currentPitch && (
            <View style={styles.centsWrap}>
              <CentsIndicator cents={currentPitch.cents} />
            </View>
          )}
        </View>

        <Pressable
          onPress={() => setShowMetronome(!showMetronome)}
          style={({ pressed }) => [
            styles.metronomeToggle,
            { backgroundColor: colors.surface, borderColor: colors.borderLight, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Ionicons name="musical-note-outline" size={20} color={colors.primary} />
          <Text style={[styles.metronomeToggleText, { color: colors.primary }]}>
            {showMetronome ? "Hide Metronome" : "Show Metronome"}
          </Text>
          <Ionicons name={showMetronome ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
        </Pressable>

        {showMetronome && (
          <View style={[styles.metronomeCard, { backgroundColor: colors.surface }, Shadows.md]}>
            <Metronome initialBpm={currentBpm} onBpmChange={setCurrentBpm} />
          </View>
        )}

        {sheetSessions.length > 0 && (
          <View style={styles.historySection}>
            <Text style={[styles.historyTitle, { color: colors.text }]}>Recent Sessions</Text>
            {sheetSessions.slice(0, 5).map((s) => (
              <View key={s.id} style={[styles.historyItem, { backgroundColor: colors.surface }]}>
                <View>
                  <Text style={[styles.historyDate, { color: colors.text }]}>
                    {new Date(s.startedAt).toLocaleDateString()}
                  </Text>
                  <Text style={[styles.historyMeta, { color: colors.textSecondary }]}>
                    {Math.floor(s.duration / 60)}m · {s.bpm} BPM
                  </Text>
                </View>
                <Text
                  style={[
                    styles.historyScore,
                    {
                      color:
                        s.accuracy >= 80 ? colors.success : s.accuracy >= 60 ? colors.warning : colors.error,
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
  container: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm + 2 },
  backBtn: { width: 40, height: 40, borderRadius: BorderRadius.sm, alignItems: "center", justifyContent: "center" },
  topBarTitle: { flex: 1 },
  titleText: { ...Typography.subtitle, fontSize: 18 },
  subtitleText: { ...Typography.small },
  topBarRight: { alignItems: "flex-end" },
  bestBadge: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.xs },
  bestText: { ...Typography.label, fontFamily: "Nunito_600SemiBold", fontWeight: "600" },
  imageContainer: { marginHorizontal: Spacing.xl, borderRadius: BorderRadius.lg, overflow: "hidden" },
  sheetImage: { width: "100%", height: 250 },
  imageOverlay: { position: "absolute", bottom: 10, left: 10, flexDirection: "row", gap: 6 },
  metaBadge: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.xs },
  metaBadgeText: { ...Typography.label, fontFamily: "Nunito_500Medium", fontWeight: "500" },
  timerSection: { marginTop: Spacing["2xl"], marginBottom: Spacing.xl },
  pitchSection: { marginHorizontal: Spacing.xl, borderRadius: BorderRadius.md, padding: Spacing.xl, marginBottom: Spacing.lg },
  centsWrap: { marginTop: Spacing.md, alignItems: "center" },
  metronomeToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm,
    marginHorizontal: Spacing.xl, padding: Spacing.sm + 6, borderRadius: BorderRadius.sm, borderWidth: 1,
  },
  metronomeToggleText: { ...Typography.body, fontFamily: "Nunito_500Medium", fontWeight: "500" },
  metronomeCard: { marginHorizontal: Spacing.xl, marginTop: Spacing.md, borderRadius: BorderRadius.lg, paddingVertical: Spacing.sm + 2 },
  historySection: { marginHorizontal: Spacing.xl, marginTop: Spacing["2xl"] },
  historyTitle: { ...Typography.subtitle, marginBottom: Spacing.md },
  historyItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.sm + 6, borderRadius: BorderRadius.sm, marginBottom: Spacing.sm },
  historyDate: { ...Typography.body, fontFamily: "Nunito_500Medium", fontWeight: "500" },
  historyMeta: { ...Typography.label, marginTop: 2 },
  historyScore: { ...Typography.subtitle, fontFamily: "Nunito_700Bold", fontWeight: "700" },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.md },
  notFoundText: { ...Typography.body, fontFamily: "Nunito_500Medium", fontWeight: "500" },
});
