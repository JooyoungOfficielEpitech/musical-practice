import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  LayoutAnimation,
  UIManager,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { Metronome } from "@/components/Metronome";
import { PracticeTimer } from "@/components/PracticeTimer";
import { MusicalStaff } from "@/components/MusicalStaff";
import { CentsIndicator } from "@/components/CentsIndicator";
import { usePractice } from "@/context/PracticeContext";
import { usePitchDetection } from "@/hooks/usePitchDetection";
import { usePitchAccuracy } from "@/hooks/usePitchAccuracy";
import { useAudioPermission } from "@/hooks/useAudioPermission";
import { ConfirmModal } from "@/components/ConfirmModal";
import { SessionCompleteModal } from "@/components/SessionCompleteModal";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { addSession, stats } = usePractice();
  const [currentBpm, setCurrentBpm] = useState(120);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [showTips, setShowTips] = useState(true);
  const tipsLoaded = useRef(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const pendingNavAction = useRef<any>(null);
  const [sessionResult, setSessionResult] = useState<{
    duration: number;
    accuracy: number;
    bpm: number;
    recordingSaved: boolean;
  } | null>(null);
  useEffect(() => {
    AsyncStorage.getItem("@musicalpractice/showTips").then((val) => {
      if (val !== null) setShowTips(val === "true");
      tipsLoaded.current = true;
    });
  }, []);

  const { isListening, currentPitch, error: pitchError, startListening, stopListening } = usePitchDetection();
  const { sessionAccuracy, addReading, reset: resetAccuracy } = usePitchAccuracy();
  const { isGranted, requestPermission } = useAudioPermission();

  // Feed pitch readings into accuracy tracker
  useEffect(() => {
    if (currentPitch) {
      addReading(currentPitch);
    }
  }, [currentPitch, addReading]);

  // Warn when leaving during active practice
  useEffect(() => {
    if (!isListening) return;
    const unsubscribe = navigation.addListener("beforeRemove", (e: any) => {
      e.preventDefault();
      pendingNavAction.current = e.data.action;
      setShowLeaveConfirm(true);
    });
    return unsubscribe;
  }, [isListening, navigation]);

  const [showMetronome, setShowMetronome] = useState(false);

  const toggleMetronome = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowMetronome((prev) => !prev);
  }, []);

  const handleTimerStart = useCallback(async (): Promise<boolean> => {
    if (!isGranted) {
      const granted = await requestPermission();
      if (!granted) return false;
    }
    resetAccuracy();
    try {
      await startListening();
      return true;
    } catch {
      return false;
    }
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
      setSessionResult({
        duration: totalSeconds,
        accuracy,
        bpm: currentBpm,
        recordingSaved: false,
      });
    },
    [addSession, currentBpm, sessionAccuracy, stopListening, resetAccuracy],
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.backgroundDefault }]}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing["5xl"] }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Practice</Text>
        {lastScore !== null && (
          <View style={[styles.lastScoreBadge, { backgroundColor: colors.warningSubtle }]}>
            <Ionicons name="trophy" size={14} color={colors.warning} />
            <Text style={[styles.lastScoreText, { color: colors.warning }]}>Last: {lastScore}%</Text>
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface }, Shadows.lg]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconWrap, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="mic-outline" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Pitch Check</Text>
        </View>
        <MusicalStaff
          isListening={isListening}
          currentPitch={currentPitch}
          accuracy={sessionAccuracy}
          error={pitchError}
        />
        {isListening && currentPitch && (
          <View style={styles.centsWrap}>
            <CentsIndicator cents={currentPitch.cents} />
          </View>
        )}
        <View style={[styles.timerWrap, { borderTopColor: colors.separator }]}>
          <PracticeTimer
            onTimeUpdate={() => {}}
            onStop={handleSessionStop}
            onStart={handleTimerStart}
          />
        </View>
      </View>

      <Pressable
        onPress={toggleMetronome}
        accessibilityLabel={showMetronome ? "Hide metronome" : "Show metronome"}
        accessibilityRole="button"
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
        <View style={[styles.metronomeCard, { backgroundColor: colors.surface }, Shadows.lg]}>
          <Metronome initialBpm={currentBpm} onBpmChange={setCurrentBpm} />
        </View>
      )}

      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setShowTips((prev) => {
            const next = !prev;
            AsyncStorage.setItem("@musicalpractice/showTips", String(next));
            return next;
          });
        }}
        style={[styles.tipsCard, { backgroundColor: colors.warningLight, borderColor: colors.warningBorder }]}
        accessibilityLabel={showTips ? "Hide practice tips" : "Show practice tips"}
        accessibilityRole="button"
      >
        <View style={styles.tipsHeader}>
          <Ionicons name="bulb-outline" size={18} color={colors.warning} />
          <Text style={[styles.tipsTitle, { color: colors.text }]}>Practice Tips</Text>
          <Ionicons name={showTips ? "chevron-up" : "chevron-down"} size={16} color={colors.warning} style={{ marginLeft: "auto" }} />
        </View>
        {showTips && (
          <View style={styles.tipsList}>
            {[
              "Start slow and gradually increase tempo",
              "Focus on difficult sections with A-B loop",
              "Take breaks every 20-30 minutes",
              "Record yourself in Library to track improvement",
            ].map((tip) => (
              <View key={tip} style={styles.tipItem}>
                <View style={[styles.tipDot, { backgroundColor: colors.warning }]} />
                <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip}</Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>

      <ConfirmModal
        visible={showLeaveConfirm}
        title="Leave Practice?"
        message="You have an active practice session. Leaving will discard your progress."
        confirmLabel="Leave"
        cancelLabel="Stay"
        destructive
        icon="warning-outline"
        onConfirm={() => {
          setShowLeaveConfirm(false);
          if (pendingNavAction.current) {
            navigation.dispatch(pendingNavAction.current);
            pendingNavAction.current = null;
          }
        }}
        onCancel={() => {
          setShowLeaveConfirm(false);
          pendingNavAction.current = null;
        }}
      />

      <SessionCompleteModal
        visible={!!sessionResult}
        result={sessionResult}
        onClose={() => setSessionResult(null)}
        streak={stats.streak}
        totalSessions={stats.totalSessions}
      />

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
  timerWrap: { marginTop: Spacing.xl, paddingTop: Spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  metronomeToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm,
    marginHorizontal: Spacing.xl, padding: Spacing.sm + 6, borderRadius: BorderRadius.sm, borderWidth: 1, marginBottom: Spacing.lg,
  },
  metronomeToggleText: { ...Typography.body, fontFamily: "Nunito_500Medium", fontWeight: "500" },
  metronomeCard: { marginHorizontal: Spacing.xl, borderRadius: BorderRadius.lg, paddingVertical: Spacing.sm + 2, marginBottom: Spacing.lg },
  tipsCard: { marginHorizontal: Spacing.xl, borderRadius: BorderRadius.lg, padding: Spacing.md + 6, borderWidth: 1, marginBottom: Spacing.xl },
  tipsHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm + 6 },
  tipsTitle: { ...Typography.body, fontFamily: "Nunito_600SemiBold", fontWeight: "600" },
  tipsList: { gap: Spacing.sm + 2 },
  tipItem: { flexDirection: "row", alignItems: "center", gap: Spacing.sm + 2 },
  tipDot: { width: 6, height: 6, borderRadius: 3 },
  tipText: { ...Typography.small, flex: 1 },
});
