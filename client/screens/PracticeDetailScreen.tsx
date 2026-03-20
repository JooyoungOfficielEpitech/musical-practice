import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  AppState,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
  useWindowDimensions,
  RefreshControl,
} from "react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { useTheme } from "@/hooks/useTheme";
import { Metronome } from "@/components/Metronome";
import { SheetMusicViewer } from "@/components/SheetMusicViewer";
import { SheetMusicPager } from "@/components/SheetMusicPager";
import { PitchPanel } from "@/components/PitchPanel";
import { FloatingPitchPanel } from "@/components/FloatingPitchPanel";
import { PracticeBottomBar } from "@/components/PracticeBottomBar";
import { AudioPlayer } from "@/components/AudioPlayer";
import { SheetFormModal, type SheetFormData } from "@/components/SheetFormModal";
import { RecordingsList } from "@/components/RecordingsList";
import { ConfirmModal } from "@/components/ConfirmModal";
import { SessionCompleteModal } from "@/components/SessionCompleteModal";
import { usePractice } from "@/context/PracticeContext";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { usePitchDetection } from "@/hooks/usePitchDetection";
import { usePitchAccuracy } from "@/hooks/usePitchAccuracy";
import { useAudioPermission } from "@/hooks/useAudioPermission";
import { useRecording } from "@/hooks/useRecording";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";
import type { RootStackParamList } from "@/types/navigation";

type PracticeDetailRouteProp = RouteProp<RootStackParamList, "PracticeDetail">;

export default function PracticeDetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<PracticeDetailRouteProp>();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { sheetId } = route.params;
  const { sheets, addSession, editSheet, removeSheet, sessions, recordings, removeRecording, renameRecording, refreshData, loading } = usePractice();
  const sheet = useMemo(() => sheets.find((s) => s.id === sheetId), [sheets, sheetId]);
  const [currentBpm, setCurrentBpm] = useState(120);
  const [showMetronome, setShowMetronome] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [isPracticing, setIsPracticing] = useState(false);
  const [isStartingPractice, setIsStartingPractice] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sessionResult, setSessionResult] = useState<{
    duration: number;
    accuracy: number;
    bpm: number;
    recordingSaved: boolean;
  } | null>(null);

  // Layout calculations
  const topBarHeight = 56;
  const bottomBarHeight = 60 + Math.max(insets.bottom, Spacing.sm);
  const practiceContentHeight = screenHeight - insets.top;

  const handleDeletePress = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!sheet) return;
    setShowDeleteConfirm(false);
    await removeSheet(sheet.id);
    navigation.goBack();
  }, [sheet, removeSheet, navigation]);

  const toggleMetronome = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowMetronome((prev) => !prev);
  }, []);

  const handleEdit = useCallback(async (data: SheetFormData) => {
    if (!sheet) return;
    await editSheet({ ...sheet, ...data });
    setShowEdit(false);
  }, [sheet, editSheet]);

  // Reference track player
  const audioPlayer = useAudioPlayer();
  useEffect(() => {
    if (__DEV__) console.log("[Practice] sheet audio check — audioUri:", sheet?.audioUri ?? "(none)", "sheet keys:", sheet ? Object.keys(sheet).join(", ") : "null");
    if (sheet?.audioUri) {
      audioPlayer.loadSound(sheet.audioUri);
    }
    return () => {
      audioPlayer.unload();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.audioUri]);

  // Recording hook
  const { isRecording, startRecording, stopRecording, addAudioData } = useRecording();
  const isRecordingRef = useRef(false);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const { isListening, currentPitch, error: pitchError, startListening, stopListening } = usePitchDetection({
    onAudioData: addAudioData,
  });
  const { sessionAccuracy, addReading, reset: resetAccuracy } = usePitchAccuracy();
  const { isGranted, requestPermission } = useAudioPermission();

  // Feed pitch readings into accuracy tracker
  useEffect(() => {
    if (currentPitch) {
      addReading(currentPitch);
    }
  }, [currentPitch, addReading]);

  const handleTimerStart = useCallback(async (): Promise<boolean> => {
    if (__DEV__) console.log("[Practice] handleTimerStart — isGranted:", isGranted, "audioPlayer.isLoaded:", audioPlayer.isLoaded);

    if (!isGranted) {
      if (__DEV__) console.log("[Practice] requesting mic permission...");
      const granted = await requestPermission();
      if (__DEV__) console.log("[Practice] permission result:", granted);
      if (!granted) return false;
    }

    resetAccuracy();

    // Configure audio session for simultaneous playback + recording BEFORE
    // starting LiveAudioStream. expo-av's playAsync() reconfigures the iOS
    // audio session based on the last setAudioModeAsync call.
    // Without allowsRecordingIOS: true, playAsync() switches to .playback
    // category which kills the microphone input from LiveAudioStream.
    if (Platform.OS !== "web") {
      try {
        if (__DEV__) console.log("[Practice] setting audio mode: allowsRecordingIOS=true");
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
        if (__DEV__) console.log("[Practice] audio mode set OK");
      } catch (e) {
        if (__DEV__) console.error("[Practice] setAudioModeAsync failed:", e);
      }
    }

    // Start recording (just sets flag, synchronous)
    if (__DEV__) console.log("[Practice] startRecording...");
    startRecording();

    // Start audio stream + pitch detection
    try {
      if (__DEV__) console.log("[Practice] startListening...");
      await startListening();
      if (__DEV__) console.log("[Practice] startListening OK");
    } catch (e) {
      console.error("[Practice] startListening FAILED:", e);
      stopRecording("__aborted__").catch(() => {});
      return false;
    }

    // Start MR playback
    if (audioPlayer.isLoaded) {
      try {
        if (__DEV__) console.log("[Practice] starting MR playback...");
        await audioPlayer.seekTo(0);
        await audioPlayer.play();
        if (__DEV__) console.log("[Practice] MR playing OK");
      } catch (e) {
        if (__DEV__) console.error("[Practice] MR playback failed:", e);
      }
    } else {
      if (__DEV__) console.log("[Practice] no MR loaded — skipping playback");
    }

    if (__DEV__) console.log("[Practice] handleTimerStart returning true");
    return true;
  }, [isGranted, requestPermission, resetAccuracy, startListening, startRecording, stopRecording, audioPlayer]);

  // Unified background cleanup: stop MR + recording + pitch together
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && isPracticing) {
        if (audioPlayer.isLoaded && audioPlayer.isPlaying) {
          audioPlayer.pause();
        }
        // Note: usePitchDetection already stops on background via its own AppState listener.
        // Recording data flow stops when pitch detection stops (no more onAudioData calls).
      }
    });
    return () => subscription.remove();
  }, [isPracticing, audioPlayer]);

  const sheetSessions = useMemo(
    () => sessions.filter((s) => s.sheetMusicId === sheetId),
    [sessions, sheetId],
  );
  const bestScore = useMemo(
    () => sheetSessions.length > 0 ? Math.max(...sheetSessions.map((s) => s.accuracy)) : null,
    [sheetSessions],
  );

  const sheetRecordings = useMemo(() => {
    const sessionIds = new Set(sheetSessions.map((s) => s.id));
    return recordings.filter((r) => sessionIds.has(r.sessionId));
  }, [sheetSessions, recordings]);

  const handleSessionStop = useCallback(
    async (totalSeconds: number) => {
      if (!sheet) return;
      stopListening();
      if (audioPlayer.isLoaded) {
        await audioPlayer.pause();
      }

      // Restore audio session to playback-only mode now that mic is stopped.
      // Safe to call after LiveAudioStream is stopped.
      if (Platform.OS !== "web") {
        Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        }).catch(() => {});
      }

      const accuracy = sessionAccuracy > 0 ? sessionAccuracy : 0;
      const wasRecording = isRecordingRef.current;

      const sessionId = await addSession({
        sheetMusicId: sheet.id,
        sheetMusicTitle: sheet.title,
        startedAt: Date.now() - totalSeconds * 1000,
        duration: totalSeconds,
        accuracy,
        bpm: currentBpm,
      });

      let recordingUri: string | undefined;
      if (wasRecording) {
        const uri = await stopRecording(sessionId);
        if (uri) recordingUri = uri;
      }

      resetAccuracy();

      if (recordingUri) {
        await refreshData();
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setSessionResult({
        duration: totalSeconds,
        accuracy,
        bpm: currentBpm,
        recordingSaved: !!recordingUri,
      });
    },
    [sheet, addSession, currentBpm, sessionAccuracy, stopListening, resetAccuracy, stopRecording, refreshData, audioPlayer],
  );

  const handleRunningChange = useCallback((running: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsPracticing(running);
  }, []);

  const handleStartPractice = useCallback(async () => {
    setIsStartingPractice(true);
    const ok = await handleTimerStart();
    setIsStartingPractice(false);
    if (ok) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsPracticing(true);
    }
  }, [handleTimerStart]);

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
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>Score not found</Text>
        </View>
      </View>
    );
  }

  // ─── Unified Layout: single PracticeBottomBar instance persists across modes ───
  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDefault, paddingTop: insets.top }]}>
      {isPracticing ? (
        <>
          {/* Semi-transparent top bar */}
          <View style={[styles.topBarOverlay, { height: topBarHeight }]}>
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityLabel="Go back"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={[styles.titleText, { color: colors.text, flex: 1 }]} numberOfLines={1}>
              {sheet.title}
            </Text>
          </View>

          {/* Full-screen sheet music */}
          <View style={styles.practiceSheetArea}>
            <SheetMusicViewer
              imageUris={sheet.imageUris}
              width={screenWidth}
              height={practiceContentHeight - topBarHeight - 48}
            />
          </View>

          {/* Floating pitch panel */}
          <FloatingPitchPanel
            isListening={isListening}
            currentPitch={currentPitch}
            accuracy={sessionAccuracy}
            pitchError={pitchError}
            isRecording={isRecording}
            currentBpm={currentBpm}
            onBpmChange={setCurrentBpm}
          />
        </>
      ) : (
        <>
          {/* Top Bar */}
          <View style={[styles.topBar, { height: topBarHeight }]}>
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityLabel="Go back"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <View style={styles.topBarTitle}>
              <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>{sheet.title}</Text>
              <Text style={[styles.subtitleText, { color: colors.textSecondary }]} numberOfLines={1}>{sheet.artist}</Text>
            </View>
            <View style={styles.topBarRight}>
              <Pressable
                onPress={() => setShowEdit(true)}
                accessibilityLabel="Edit score"
                accessibilityRole="button"
                hitSlop={8}
                style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="create-outline" size={22} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={handleDeletePress}
                accessibilityLabel="Delete score"
                accessibilityRole="button"
                hitSlop={8}
                style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </Pressable>
              {bestScore !== null && (
                <View style={[styles.bestBadge, { backgroundColor: colors.warningSubtle }]}>
                  <Ionicons name="trophy" size={12} color={colors.warning} />
                  <Text style={[styles.bestText, { color: colors.warning }]}>{bestScore}%</Text>
                </View>
              )}
            </View>
          </View>

          {/* Scrollable Browse Content */}
          <ScrollView
            style={styles.browseScroll}
            contentContainerStyle={styles.browseContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={refreshData} tintColor={colors.primary} />
            }
          >
            {/* Sheet Music Pager */}
            <View style={styles.pagerWrap}>
              <SheetMusicPager imageUris={sheet.imageUris} />
            </View>

            {/* Start Practice CTA */}
            <Pressable
              onPress={handleStartPractice}
              disabled={isStartingPractice}
              accessibilityLabel="Start practice session"
              accessibilityRole="button"
              accessibilityState={{ busy: isStartingPractice }}
              style={({ pressed }) => [
                styles.startPracticeBtn,
                {
                  backgroundColor: isStartingPractice ? colors.textSecondary : colors.primaryDark,
                  opacity: pressed && !isStartingPractice ? 0.9 : 1,
                },
              ]}
            >
              {isStartingPractice ? (
                <ActivityIndicator size="small" color={colors.buttonText} />
              ) : (
                <Ionicons name="play" size={22} color={colors.buttonText} />
              )}
              <Text style={[styles.startPracticeText, { color: colors.buttonText }]}>
                {isStartingPractice ? "Preparing…" : "Start Practice"}
              </Text>
            </Pressable>

            {/* Practice Card: Pitch + Cents + Recording */}
            <View style={[styles.practiceCard, { backgroundColor: colors.surface }, Shadows.sm]}>
              <PitchPanel
                width={screenWidth - Spacing.lg * 2}
                isListening={isListening}
                currentPitch={currentPitch}
                accuracy={sessionAccuracy}
                error={pitchError}
                isRecording={isRecording}
              />
            </View>

            {/* Audio Player */}
            {sheet.audioUri && (
              <View style={styles.browseSection}>
                <View style={styles.sectionLabel}>
                  <Ionicons name="musical-notes-outline" size={14} color={colors.primary} />
                  <Text style={[styles.sectionLabelText, { color: colors.primary }]}>Reference Track</Text>
                </View>
                <AudioPlayer audioUri={sheet.audioUri} externalPlayer={audioPlayer} />
              </View>
            )}

            {/* Metronome (collapsible) */}
            <Pressable
              onPress={toggleMetronome}
              accessibilityLabel={showMetronome ? "Hide metronome" : "Show metronome"}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.metronomeToggle,
                { borderColor: colors.borderLight, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Ionicons name="musical-note-outline" size={16} color={colors.primary} />
              <Text style={[styles.metronomeToggleText, { color: colors.primary }]}>
                {showMetronome ? "Hide Metronome" : "Show Metronome"}
              </Text>
              <Ionicons name={showMetronome ? "chevron-up" : "chevron-down"} size={14} color={colors.textSecondary} />
            </Pressable>

            {showMetronome && (
              <View style={styles.metronomeWrap}>
                <Metronome initialBpm={currentBpm} onBpmChange={setCurrentBpm} />
              </View>
            )}

            {/* Recordings */}
            <View style={[styles.sectionDivider, { borderTopColor: colors.separator }]} />
            <View style={styles.browseSection}>
              <View style={styles.recordingsHeader}>
                <Ionicons name="mic-outline" size={16} color={colors.text} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Recordings</Text>
                <Text style={[styles.recordingsCount, { color: colors.textSecondary }]}>
                  {sheetRecordings.length}
                </Text>
              </View>
              <RecordingsList recordings={sheetRecordings} onDelete={removeRecording} onRename={renameRecording} />
            </View>

            {/* Session History */}
            {sheetSessions.length > 0 && (
              <>
                <View style={[styles.sectionDivider, { borderTopColor: colors.separator }]} />
                <View style={styles.browseSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Sessions</Text>
                  {sheetSessions.slice(0, 5).map((s) => (
                    <View
                      key={s.id}
                      accessible
                      accessibilityLabel={`${new Date(s.startedAt).toLocaleDateString()}, ${Math.floor(s.duration / 60)} minutes, ${s.bpm} BPM, accuracy ${s.accuracy}%`}
                      style={[styles.historyItem, { backgroundColor: colors.surface }]}
                    >
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
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* Practice mode bottom bar — only shown during active practice */}
      {isPracticing && (
        <PracticeBottomBar
          onStop={handleSessionStop}
          onRunningChange={handleRunningChange}
          minimal
          autoStart
        />
      )}

      <SheetFormModal
        visible={showEdit}
        onClose={() => setShowEdit(false)}
        onSubmit={handleEdit}
        initialData={sheet}
      />

      <ConfirmModal
        visible={showDeleteConfirm}
        title="Delete Score"
        message={`Remove "${sheet.title}" from library?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        icon="trash-outline"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <SessionCompleteModal
        visible={!!sessionResult}
        result={sessionResult}
        onClose={() => setSessionResult(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm + 2,
  },
  topBarOverlay: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm + 2,
    zIndex: 10,
  },
  backBtn: { width: 44, height: 44, borderRadius: BorderRadius.sm, alignItems: "center", justifyContent: "center" },
  topBarTitle: { flex: 1 },
  titleText: { ...Typography.subtitle, fontSize: 18 },
  subtitleText: { ...Typography.small },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  actionBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  bestBadge: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.xs },
  bestText: { ...Typography.label, fontFamily: "Nunito_600SemiBold", fontWeight: "600" },

  // Browse mode
  browseScroll: {
    flex: 1,
  },
  browseContent: {
    paddingBottom: Spacing["2xl"],
  },
  pagerWrap: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  startPracticeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    minHeight: Spacing.buttonHeight,
  },
  startPracticeText: {
    ...Typography.subtitle,
    fontFamily: "Nunito_700Bold",
    fontWeight: "700",
  },
  practiceCard: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  browseSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  sectionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
  },
  metronomeToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    minHeight: 44,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  metronomeToggleText: {
    ...Typography.label,
    fontFamily: "Nunito_500Medium",
    fontWeight: "500",
  },
  metronomeWrap: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  sectionLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  sectionLabelText: {
    ...Typography.label,
    fontFamily: "Nunito_600SemiBold",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  recordingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  recordingsCount: {
    ...Typography.label,
    fontFamily: "Nunito_500Medium",
    fontWeight: "500",
  },
  sectionTitle: {
    ...Typography.label,
    fontFamily: "Nunito_600SemiBold",
    fontWeight: "600",
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.xs,
  },
  historyDate: {
    ...Typography.label,
    fontFamily: "Nunito_500Medium",
    fontWeight: "500",
  },
  historyMeta: {
    ...Typography.label,
    marginTop: 1,
  },
  historyScore: {
    ...Typography.body,
    fontFamily: "Nunito_700Bold",
    fontWeight: "700",
  },

  // Practice mode
  practiceSheetArea: {
    flex: 1,
  },

  // Shared
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.md },
  notFoundText: { ...Typography.body, fontFamily: "Nunito_500Medium", fontWeight: "500" },
});
