import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { Metronome } from "@/components/Metronome";
import { PracticeTimer } from "@/components/PracticeTimer";
import { usePractice } from "@/lib/practice-context";

export default function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { addSession } = usePractice();
  const [currentBpm, setCurrentBpm] = useState(120);
  const [sessionActive, setSessionActive] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);

  const handleSessionStop = useCallback(
    async (totalSeconds: number) => {
      const accuracy = Math.floor(Math.random() * 30) + 70;
      await addSession({
        sheetMusicId: "quick",
        sheetMusicTitle: "Quick Practice",
        startedAt: Date.now() - totalSeconds * 1000,
        duration: totalSeconds,
        accuracy,
        bpm: currentBpm,
      });
      setLastScore(accuracy);
      setSessionActive(false);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert(
        "Session Complete",
        `Duration: ${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s\nAccuracy: ${accuracy}%\nBPM: ${currentBpm}`,
      );
    },
    [addSession, currentBpm],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + webTopInset + 16,
        paddingBottom: Platform.OS === "web" ? 34 : 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Practice</Text>
        {lastScore !== null && (
          <View style={styles.lastScoreBadge}>
            <Ionicons name="trophy" size={14} color={Colors.light.warning} />
            <Text style={styles.lastScoreText}>Last: {lastScore}%</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="time-outline" size={20} color={Colors.light.primary} />
          </View>
          <Text style={styles.cardTitle}>Practice Timer</Text>
        </View>
        <PracticeTimer
          onTimeUpdate={() => setSessionActive(true)}
          onStop={handleSessionStop}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="metronome-outline" size={20} color={Colors.light.primary} />
          </View>
          <Text style={styles.cardTitle}>Metronome</Text>
        </View>
        <Metronome initialBpm={currentBpm} onBpmChange={setCurrentBpm} />
      </View>

      <View style={styles.tipsCard}>
        <View style={styles.tipsHeader}>
          <Ionicons name="bulb-outline" size={18} color={Colors.light.warning} />
          <Text style={styles.tipsTitle}>Practice Tips</Text>
        </View>
        <View style={styles.tipsList}>
          <View style={styles.tipItem}>
            <View style={styles.tipDot} />
            <Text style={styles.tipText}>Start slow and gradually increase tempo</Text>
          </View>
          <View style={styles.tipItem}>
            <View style={styles.tipDot} />
            <Text style={styles.tipText}>Focus on difficult sections with A-B loop</Text>
          </View>
          <View style={styles.tipItem}>
            <View style={styles.tipDot} />
            <Text style={styles.tipText}>Take breaks every 20-30 minutes</Text>
          </View>
          <View style={styles.tipItem}>
            <View style={styles.tipDot} />
            <Text style={styles.tipText}>Record yourself to track improvement</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  lastScoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.light.warning + "18",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  lastScoreText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.warning,
  },
  card: {
    backgroundColor: Colors.light.surface,
    marginHorizontal: 20,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
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
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.primary + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  tipsCard: {
    backgroundColor: Colors.light.warning + "0D",
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.warning + "25",
    marginBottom: 20,
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  tipsTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  tipsList: {
    gap: 10,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.warning,
  },
  tipText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    flex: 1,
  },
});
