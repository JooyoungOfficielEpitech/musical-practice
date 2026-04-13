import React from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { SheetMusicPager } from "@/components/SheetMusicPager";
import { PitchPanel } from "@/components/PitchPanel";
import { AudioPlayer } from "@/components/AudioPlayer";
import { InteractiveScore } from "@/components/InteractiveScore";
import { Metronome } from "@/components/Metronome";
import { RecordingsList } from "@/components/RecordingsList";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";
import type { SheetMusic } from "@/lib/storage";
import type { PracticeDetailState } from "@/hooks/usePracticeDetail";
import type { Recording } from "@/lib/audio/types";

function formatSynthTime(seconds: number): string {
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

export interface PracticeBrowseViewProps {
  sheet: SheetMusic;
  state: PracticeDetailState;
  screenWidth: number;
  loading: boolean;
  onRefresh: () => void;
  onGoBack: () => void;
  removeRecording: (id: string) => void;
  renameRecording: (id: string, name: string) => Promise<void>;
}

export function PracticeBrowseView({
  sheet, state, screenWidth, loading, onRefresh, onGoBack, removeRecording, renameRecording,
}: PracticeBrowseViewProps): React.JSX.Element {
  const { colors } = useTheme();
  const {
    currentBpm, setCurrentBpm, showMetronome, setShowEdit,
    isStartingPractice, audioMode, setAudioMode,
    musicXmlContent, musicXmlLoading, hasMusicXml,
    setShowInstrumentPicker, editMode, setEditMode,
    sheetSessions, bestScore, sheetRecordings,
    synthPlayer, audioPlayer, noteEditor,
    isListening, currentPitch, pitchError, sessionAccuracy, isRecording, omr,
    handleNotePress, handleSynthPlayPause, handleScanSheet,
    handleStartPractice, handleDeletePress, toggleMetronome,
  } = state;

  return (
    <>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={onGoBack}
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
          <Pressable onPress={() => setShowEdit(true)} accessibilityLabel="Edit score" accessibilityRole="button" hitSlop={8} style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="create-outline" size={22} color={colors.text} />
          </Pressable>
          <Pressable onPress={handleDeletePress} accessibilityLabel="Delete score" accessibilityRole="button" hitSlop={8} style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}>
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

      {/* Scrollable Content */}
      <ScrollView style={styles.browseScroll} contentContainerStyle={styles.browseContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.pagerWrap}><SheetMusicPager imageUris={sheet.imageUris} /></View>

        {/* Scan button */}
        {sheet.imageUris.length > 0 && sheet.omrStatus !== "ready" && (
          <Pressable onPress={handleScanSheet} disabled={omr.isProcessing} accessibilityLabel="Scan sheet music for auto-play" accessibilityRole="button" accessibilityState={{ busy: omr.isProcessing }}
            style={({ pressed }) => [styles.scanBtn, { backgroundColor: omr.isProcessing ? colors.backgroundSecondary : colors.surface, borderColor: colors.primary, opacity: pressed && !omr.isProcessing ? 0.8 : 1 }]}
          >
            {omr.isProcessing ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="scan-outline" size={18} color={colors.primary} />}
            <Text style={[styles.scanBtnText, { color: colors.primary }]}>{omr.isProcessing ? "Scanning..." : omr.error ? "Retry Scan" : "Scan Sheet Music"}</Text>
          </Pressable>
        )}
        {omr.error && sheet.omrStatus !== "ready" && <Text style={[styles.scanErrorText, { color: colors.error }]}>{omr.error}</Text>}

        {/* Start Practice CTA */}
        <Pressable onPress={handleStartPractice} disabled={isStartingPractice} accessibilityLabel="Start practice session" accessibilityRole="button" accessibilityState={{ busy: isStartingPractice }}
          style={({ pressed }) => [styles.startPracticeBtn, { backgroundColor: isStartingPractice ? colors.textSecondary : colors.primaryDark, opacity: pressed && !isStartingPractice ? 0.9 : 1 }]}
        >
          {isStartingPractice ? <ActivityIndicator size="small" color={colors.buttonText} /> : <Ionicons name="play" size={22} color={colors.buttonText} />}
          <Text style={[styles.startPracticeText, { color: colors.buttonText }]}>{isStartingPractice ? "Preparing…" : "Start Practice"}</Text>
        </Pressable>

        {/* Pitch panel */}
        <View style={[styles.practiceCard, { backgroundColor: colors.surface }, Shadows.sm]}>
          <PitchPanel width={screenWidth - Spacing.lg * 2} isListening={isListening} currentPitch={currentPitch} accuracy={sessionAccuracy} error={pitchError} isRecording={isRecording} />
        </View>

        {/* Audio / Auto-Play section */}
        {(sheet.audioUri || hasMusicXml) && (
          <View style={styles.browseSection}>
            {sheet.audioUri && hasMusicXml && (
              <View style={[styles.segmentedControl, { backgroundColor: colors.backgroundSecondary }]}>
                <Pressable onPress={() => setAudioMode("reference")} style={[styles.segmentButton, audioMode === "reference" && { backgroundColor: colors.surface }]} accessibilityLabel="Reference Track" accessibilityRole="tab" accessibilityState={{ selected: audioMode === "reference" }}>
                  <Ionicons name="musical-notes-outline" size={14} color={audioMode === "reference" ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.segmentText, { color: audioMode === "reference" ? colors.primary : colors.textSecondary }]}>Reference</Text>
                </Pressable>
                <Pressable onPress={() => setAudioMode("autoplay")} style={[styles.segmentButton, audioMode === "autoplay" && { backgroundColor: colors.surface }]} accessibilityLabel="Auto-Play" accessibilityRole="tab" accessibilityState={{ selected: audioMode === "autoplay" }}>
                  <Ionicons name="play-circle-outline" size={14} color={audioMode === "autoplay" ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.segmentText, { color: audioMode === "autoplay" ? colors.primary : colors.textSecondary }]}>Auto-Play</Text>
                </Pressable>
              </View>
            )}
            {audioMode === "reference" && sheet.audioUri && (
              <>
                <View style={styles.sectionLabel}><Ionicons name="musical-notes-outline" size={14} color={colors.primary} /><Text style={[styles.sectionLabelText, { color: colors.primary }]}>Reference Track</Text></View>
                <AudioPlayer audioUri={sheet.audioUri} externalPlayer={audioPlayer} />
              </>
            )}
            {audioMode === "autoplay" && hasMusicXml && (
              <>
                <View style={styles.sectionLabel}><Ionicons name="play-circle-outline" size={14} color={colors.primary} /><Text style={[styles.sectionLabelText, { color: colors.primary }]}>Auto-Play</Text></View>
                {musicXmlLoading ? (
                  <View style={[styles.autoplayLoading, { backgroundColor: colors.surface }]}><ActivityIndicator size="small" color={colors.primary} /><Text style={[styles.autoplayLoadingText, { color: colors.textSecondary }]}>Loading score...</Text></View>
                ) : musicXmlContent ? (
                  <>
                    <InteractiveScore musicXml={noteEditor.editedMusicXml || musicXmlContent} currentNoteIndex={synthPlayer.currentNoteIndex} onNotePress={editMode ? noteEditor.selectNote : handleNotePress} />
                    <View style={[styles.synthControls, { backgroundColor: colors.surface }, Shadows.sm]}>
                      <Pressable onPress={handleSynthPlayPause} accessibilityLabel={synthPlayer.isPlaying ? "Pause synth" : "Play synth"} accessibilityRole="button" style={({ pressed }) => [styles.synthPlayButton, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}>
                        <Ionicons name={synthPlayer.isPlaying ? "pause" : "play"} size={20} color={colors.buttonText} />
                      </Pressable>
                      <View style={styles.synthTrackSection}>
                        <View style={[styles.synthTrackBg, { backgroundColor: colors.borderLight }]}>
                          <View style={[styles.synthTrackProgress, { backgroundColor: colors.primary, width: synthPlayer.durationMs > 0 ? `${(synthPlayer.positionMs / synthPlayer.durationMs) * 100}%` : "0%" }]} />
                        </View>
                        <View style={styles.synthTimeRow}>
                          <Text style={[styles.synthTimeText, { color: colors.textSecondary }]}>{formatSynthTime(synthPlayer.positionMs / 1000)}</Text>
                          <Text style={[styles.synthTimeText, { color: colors.textSecondary }]}>{formatSynthTime(synthPlayer.durationMs / 1000)}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={[styles.tempoControl, { backgroundColor: colors.surface }, Shadows.sm]}>
                      <Ionicons name="speedometer-outline" size={16} color={colors.textSecondary} />
                      <Text style={[styles.tempoLabel, { color: colors.textSecondary }]}>Tempo</Text>
                      <View style={styles.tempoStepper}>
                        <Pressable onPress={() => synthPlayer.setTempo(Math.max(0.5, synthPlayer.tempo - 0.25))} accessibilityLabel="Decrease tempo" accessibilityRole="button" style={({ pressed }) => [styles.tempoStepBtn, { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.7 : 1 }]}><Ionicons name="remove" size={16} color={colors.text} /></Pressable>
                        <Text style={[styles.tempoValue, { color: colors.text }]}>{synthPlayer.tempo.toFixed(2)}x</Text>
                        <Pressable onPress={() => synthPlayer.setTempo(Math.min(2.0, synthPlayer.tempo + 0.25))} accessibilityLabel="Increase tempo" accessibilityRole="button" style={({ pressed }) => [styles.tempoStepBtn, { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.7 : 1 }]}><Ionicons name="add" size={16} color={colors.text} /></Pressable>
                      </View>
                    </View>
                    <Pressable onPress={() => setEditMode((prev) => !prev)} accessibilityLabel={editMode ? "Exit edit mode" : "Edit notes"} accessibilityRole="button" style={({ pressed }) => [styles.instrumentRow, { backgroundColor: editMode ? colors.primary : colors.surface, opacity: pressed ? 0.8 : 1 }]}>
                      <Ionicons name="create-outline" size={16} color={editMode ? "#fff" : colors.textSecondary} />
                      <Text style={[styles.tempoLabel, { color: editMode ? "#fff" : colors.textSecondary }]}>{editMode ? "Editing" : "Edit Notes"}</Text>
                      {noteEditor.hasEdits && <Text style={[styles.instrumentBtnText, { color: editMode ? "#fff" : colors.primary }]}>(edited)</Text>}
                    </Pressable>
                    <Pressable onPress={() => setShowInstrumentPicker(true)} accessibilityLabel="Change instrument" accessibilityRole="button" style={({ pressed }) => [styles.instrumentRow, { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 }]}>
                      <Ionicons name="musical-note-outline" size={16} color={colors.textSecondary} />
                      <Text style={[styles.tempoLabel, { color: colors.textSecondary }]}>Sound</Text>
                      <View style={styles.instrumentButtons}>
                        <Text style={[styles.instrumentBtnText, { color: colors.text }]}>{synthPlayer.instrument === "piano" ? "Piano" : synthPlayer.instrument === "oscillator" ? "Sine Wave" : synthPlayer.instrument}</Text>
                        {synthPlayer.instrumentLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />}
                      </View>
                    </Pressable>
                  </>
                ) : (
                  <View style={[styles.autoplayLoading, { backgroundColor: colors.surface }]}><Ionicons name="alert-circle-outline" size={20} color={colors.textSecondary} /><Text style={[styles.autoplayLoadingText, { color: colors.textSecondary }]}>Failed to load score</Text></View>
                )}
              </>
            )}
          </View>
        )}

        {/* Metronome */}
        <Pressable onPress={toggleMetronome} accessibilityLabel={showMetronome ? "Hide metronome" : "Show metronome"} accessibilityRole="button" style={({ pressed }) => [styles.metronomeToggle, { borderColor: colors.borderLight, opacity: pressed ? 0.9 : 1 }]}>
          <Ionicons name="musical-note-outline" size={16} color={colors.primary} />
          <Text style={[styles.metronomeToggleText, { color: colors.primary }]}>{showMetronome ? "Hide Metronome" : "Show Metronome"}</Text>
          <Ionicons name={showMetronome ? "chevron-up" : "chevron-down"} size={14} color={colors.textSecondary} />
        </Pressable>
        {showMetronome && <View style={styles.metronomeWrap}><Metronome initialBpm={currentBpm} onBpmChange={setCurrentBpm} /></View>}

        {/* Recordings */}
        <View style={[styles.sectionDivider, { borderTopColor: colors.separator }]} />
        <View style={styles.browseSection}>
          <View style={styles.recordingsHeader}>
            <Ionicons name="mic-outline" size={16} color={colors.text} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recordings</Text>
            <Text style={[styles.recordingsCount, { color: colors.textSecondary }]}>{sheetRecordings.length}</Text>
          </View>
          <RecordingsList recordings={sheetRecordings as Recording[]} onDelete={removeRecording} onRename={renameRecording} />
        </View>

        {/* Session history */}
        {sheetSessions.length > 0 && (
          <>
            <View style={[styles.sectionDivider, { borderTopColor: colors.separator }]} />
            <View style={styles.browseSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Sessions</Text>
              {sheetSessions.slice(0, 5).map((s) => (
                <View key={s.id} accessible accessibilityLabel={`${new Date(s.startedAt).toLocaleDateString()}, ${Math.floor(s.duration / 60)} minutes, ${s.bpm} BPM, accuracy ${s.accuracy}%`} style={[styles.historyItem, { backgroundColor: colors.surface }]}>
                  <View>
                    <Text style={[styles.historyDate, { color: colors.text }]}>{new Date(s.startedAt).toLocaleDateString()}</Text>
                    <Text style={[styles.historyMeta, { color: colors.textSecondary }]}>{Math.floor(s.duration / 60)}m · {s.bpm} BPM</Text>
                  </View>
                  <Text style={[styles.historyScore, { color: s.accuracy >= 80 ? colors.success : s.accuracy >= 60 ? colors.warning : colors.error }]}>{s.accuracy}%</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  topBar: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.lg, gap: Spacing.sm + 2 },
  backBtn: { width: 44, height: 44, borderRadius: BorderRadius.sm, alignItems: "center", justifyContent: "center" },
  topBarTitle: { flex: 1 },
  titleText: { ...Typography.subtitle, fontSize: 18 },
  subtitleText: { ...Typography.small },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  actionBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  bestBadge: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.xs },
  bestText: { ...Typography.label, fontFamily: "Nunito_600SemiBold", fontWeight: "600" },
  browseScroll: { flex: 1 },
  browseContent: { paddingBottom: Spacing["2xl"] },
  pagerWrap: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  scanBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, paddingVertical: Spacing.sm + 2, borderRadius: BorderRadius.md, borderWidth: 1 },
  scanBtnText: { ...Typography.label, fontFamily: "Nunito_600SemiBold", fontWeight: "600" },
  scanErrorText: { ...Typography.small, textAlign: "center", marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  startPracticeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, minHeight: Spacing.buttonHeight },
  startPracticeText: { ...Typography.subtitle, fontFamily: "Nunito_700Bold", fontWeight: "700" },
  practiceCard: { marginHorizontal: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.sm },
  browseSection: { paddingHorizontal: Spacing.lg, marginTop: Spacing.sm },
  sectionDivider: { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: Spacing.sm, marginHorizontal: Spacing.lg },
  metronomeToggle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.xs, marginHorizontal: Spacing.lg, marginTop: Spacing.sm, minHeight: 44, paddingVertical: Spacing.sm, borderRadius: BorderRadius.xs, borderWidth: 1 },
  metronomeToggleText: { ...Typography.label, fontFamily: "Nunito_500Medium", fontWeight: "500" },
  metronomeWrap: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  sectionLabel: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.xs },
  sectionLabelText: { ...Typography.label, fontFamily: "Nunito_600SemiBold", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  recordingsHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.sm },
  recordingsCount: { ...Typography.label, fontFamily: "Nunito_500Medium", fontWeight: "500" },
  sectionTitle: { ...Typography.label, fontFamily: "Nunito_600SemiBold", fontWeight: "600" },
  historyItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.sm, borderRadius: BorderRadius.xs, marginTop: Spacing.xs },
  historyDate: { ...Typography.label, fontFamily: "Nunito_500Medium", fontWeight: "500" },
  historyMeta: { ...Typography.label, marginTop: 1 },
  historyScore: { ...Typography.body, fontFamily: "Nunito_700Bold", fontWeight: "700" },
  segmentedControl: { flexDirection: "row", borderRadius: BorderRadius.sm, padding: 2, marginBottom: Spacing.sm },
  segmentButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.xs, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm - 1 },
  segmentText: { ...Typography.label, fontFamily: "Nunito_600SemiBold", fontWeight: "600" },
  autoplayLoading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, padding: Spacing.lg, borderRadius: BorderRadius.md },
  autoplayLoadingText: { ...Typography.body },
  synthControls: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.md, marginTop: Spacing.sm },
  synthPlayButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  synthTrackSection: { flex: 1, gap: Spacing.xs },
  synthTrackBg: { height: 8, borderRadius: 4, overflow: "hidden" },
  synthTrackProgress: { height: "100%", borderRadius: 2 },
  synthTimeRow: { flexDirection: "row", justifyContent: "space-between" },
  synthTimeText: { ...Typography.label, fontFamily: "Nunito_500Medium", fontWeight: "500" },
  tempoControl: { flexDirection: "row", alignItems: "center", padding: Spacing.sm, borderRadius: BorderRadius.md, gap: Spacing.sm, marginTop: Spacing.xs },
  tempoLabel: { ...Typography.label, fontFamily: "Nunito_500Medium", fontWeight: "500", flex: 1 },
  tempoStepper: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  tempoStepBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  tempoValue: { ...Typography.label, fontFamily: "Nunito_700Bold", fontWeight: "700", minWidth: 48, textAlign: "center" },
  instrumentRow: { flexDirection: "row", alignItems: "center", padding: Spacing.sm, borderRadius: BorderRadius.md, gap: Spacing.sm, marginTop: Spacing.xs },
  instrumentButtons: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  instrumentBtnText: { ...Typography.label, fontFamily: "Nunito_600SemiBold", fontWeight: "600" },
});
