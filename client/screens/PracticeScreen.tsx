import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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

export default function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { addSession } = usePractice();
  const [currentBpm, setCurrentBpm] = useState(120);
  const [lastScore, setLastScore] = useState<number | null>(null);

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

  const handleSessionStop = useCallback(
    async (totalSeconds: number) => {
      stopListening();
      const accuracy = sessionAccuracy > 0 ? sessionAccuracy : 0;
      await addSession({
        sheetMusicId: "quick",
        sheetMusicTitle: "Quick Practice",
        startedAt: Date.now() - totalSeconds * 1000,
        duration: totalSeconds,
        accuracy,
        bpm: currentBpm,
      });
      setLastScore(accuracy);
      resetAccuracy();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert(
        "Session Complete",
        `Duration: ${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s\nAccuracy: ${accuracy}%\nBPM: ${currentBpm}`,
      );
    },
    [addSession, currentBpm, sessionAccuracy, stopListening, resetAccuracy],
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.backgroundDefault }]}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.lg, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Practice</Text>
        {lastScore !== null && (
          <View style={[styles.lastScoreBadge, { backgroundColor: colors.warning + "18" }]}>
            <Ionicons name="trophy" size={14} color={colors.warning} />
            <Text style={[styles.lastScoreText, { color: colors.warning }]}>Last: {lastScore}%</Text>
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface }, Shadows.lg]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconWrap, { backgroundColor: colors.primary + "18" }]}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Practice Timer</Text>
        </View>
        <PracticeTimer onTimeUpdate={() => {}} onStop={handleSessionStop} onStart={handleTimerStart} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface }, Shadows.lg]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconWrap, { backgroundColor: colors.primary + "18" }]}>
            <Ionicons name="mic-outline" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Pitch Detection</Text>
        </View>
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

      <View style={[styles.card, { backgroundColor: colors.surface }, Shadows.lg]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconWrap, { backgroundColor: colors.primary + "18" }]}>
            <Ionicons name="musical-note-outline" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Metronome</Text>
        </View>
        <Metronome initialBpm={currentBpm} onBpmChange={setCurrentBpm} />
      </View>

      <View style={[styles.tipsCard, { backgroundColor: colors.warning + "0D", borderColor: colors.warning + "25" }]}>
        <View style={styles.tipsHeader}>
          <Ionicons name="bulb-outline" size={18} color={colors.warning} />
          <Text style={[styles.tipsTitle, { color: colors.text }]}>Practice Tips</Text>
        </View>
        <View style={styles.tipsList}>
          {[
            "Start slow and gradually increase tempo",
            "Focus on difficult sections with A-B loop",
            "Take breaks every 20-30 minutes",
            "Record yourself to track improvement",
          ].map((tip) => (
            <View key={tip} style={styles.tipItem}>
              <View style={[styles.tipDot, { backgroundColor: colors.warning }]} />
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  title: { ...Typography.h2 },
  lastScoreBadge: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, paddingHorizontal: Spacing.sm + 2, paddingVertical: 5, borderRadius: BorderRadius.sm },
  lastScoreText: { ...Typography.small, fontFamily: "Nunito_600SemiBold", fontWeight: "600" },
  card: { marginHorizontal: Spacing.xl, borderRadius: BorderRadius.md, padding: Spacing.xl, marginBottom: Spacing.lg },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm + 2, marginBottom: Spacing.lg },
  cardIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle: { ...Typography.subtitle },
  centsWrap: { marginTop: Spacing.md, alignItems: "center" },
  tipsCard: { marginHorizontal: Spacing.xl, borderRadius: BorderRadius.lg, padding: Spacing.md + 6, borderWidth: 1, marginBottom: Spacing.xl },
  tipsHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm + 6 },
  tipsTitle: { ...Typography.body, fontFamily: "Nunito_600SemiBold", fontWeight: "600" },
  tipsList: { gap: Spacing.sm + 2 },
  tipItem: { flexDirection: "row", alignItems: "center", gap: Spacing.sm + 2 },
  tipDot: { width: 6, height: 6, borderRadius: 3 },
  tipText: { ...Typography.small, flex: 1 },
});
