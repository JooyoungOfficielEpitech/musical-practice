import React, { useState } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { SheetMusicPager } from "@/components/SheetMusicPager";
import { PitchPanel } from "@/components/PitchPanel";
import { InteractiveScore } from "@/components/InteractiveScore";
import { RecordingsList } from "@/components/RecordingsList";
import { MetronomeBottomSheet } from "@/components/MetronomeBottomSheet";
import { AudioBottomSheet } from "@/components/AudioBottomSheet";
import { Spacing, BorderRadius, Typography, Shadows, Fonts, ClayShadow, ClayShadowSmall } from "@/constants/theme";
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
  const [metronomeVisible, setMetronomeVisible] = useState(false);
  const [audioVisible, setAudioVisible] = useState(false);

  const {
    currentBpm, setShowEdit, isStartingPractice, musicXmlContent, musicXmlLoading,
    hasMusicXml, setShowInstrumentPicker, editMode, setEditMode, bestScore,
    sheetRecordings, synthPlayer, noteEditor, isListening, currentPitch, pitchError,
    sessionAccuracy, isRecording, omr, handleNotePress, handleSynthPlayPause,
    handleScanSheet, handleStartPractice, handleDeletePress,
  } = state;

  return (
    <>
      <View style={styles.topBar}>
        <Pressable onPress={onGoBack} accessibilityLabel="Go back" accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}>
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
          <Text style={[styles.startPracticeText, { color: colors.buttonText }]}>{isStartingPractice ? "Preparing..." : "Start Practice"}</Text>
        </Pressable>

        {/* Pitch panel */}
        <View style={[styles.practiceCard, { backgroundColor: colors.surface }, Shadows.sm]}>
          <PitchPanel width={screenWidth - Spacing.lg * 2} isListening={isListening} currentPitch={currentPitch} accuracy={sessionAccuracy} error={pitchError} isRecording={isRecording} />
        </View>

        <View style={styles.quickActions}>
          <Pressable onPress={() => setMetronomeVisible(true)} accessibilityLabel="Open metronome" accessibilityRole="button"
            style={({ pressed }) => [styles.quickActionBtn, { borderColor: colors.borderLight, opacity: pressed ? 0.9 : 1 }]}>
            <Ionicons name="musical-note-outline" size={16} color={colors.primary} />
            <Text style={[styles.quickActionText, { color: colors.primary }]}>Metronome</Text>
          </Pressable>
          {sheet.audioUri && (
            <Pressable onPress={() => setAudioVisible(true)} accessibilityLabel="Open audio player" accessibilityRole="button"
              style={({ pressed }) => [styles.quickActionBtn, { borderColor: colors.borderLight, opacity: pressed ? 0.9 : 1 }]}>
              <Ionicons name="headset-outline" size={16} color={colors.primary} />
              <Text style={[styles.quickActionText, { color: colors.primary }]}>Reference Audio</Text>
            </Pressable>
          )}
        </View>

        {/* Auto-Play section */}
        {hasMusicXml && (
          <View style={styles.browseSection}>
            <View style={styles.sectionLabel}><Ionicons name="play-circle-outline" size={14} color={colors.primary} /><Text style={[styles.sectionLabelText, { color: colors.primary }]}>Auto-Play</Text></View>
            {musicXmlLoading ? (
              <View style={[styles.autoplayLoading, { backgroundColor: colors.surface }]}><ActivityIndicator size="small" color={colors.primary} /><Text style={[styles.autoplayLoadingText, { color: colors.textSecondary }]}>Loading score...</Text></View>
            ) : musicXmlContent ? (
              <>
                <InteractiveScore musicXml={noteEditor.editedMusicXml || musicXmlContent} positionMs={synthPlayer.positionMs * synthPlayer.tempo} onNotePress={editMode ? noteEditor.selectNote : handleNotePress} />
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
          </View>
        )}

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

      </ScrollView>

      <MetronomeBottomSheet visible={metronomeVisible} onDismiss={() => setMetronomeVisible(false)} initialBpm={currentBpm} />
      <AudioBottomSheet visible={audioVisible} onDismiss={() => setAudioVisible(false)} audioUrl={sheet.audioUri} />
    </>
  );
}

const row = { flexDirection: "row" as const, alignItems: "center" as const };
const semibold = { ...Typography.label, fontFamily: "Nunito_600SemiBold" as const, fontWeight: "600" as const };
const medium = { ...Typography.label, fontFamily: "Nunito_500Medium" as const, fontWeight: "500" as const };

const styles = StyleSheet.create({
  topBar: { ...row, height: 56, paddingHorizontal: Spacing.lg, gap: Spacing.sm + 2 },
  backBtn: { width: 44, height: 44, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  topBarTitle: { flex: 1 },
  titleText: { ...Typography.subtitle, fontFamily: Fonts.heading, fontSize: 18 },
  subtitleText: { ...Typography.small },
  topBarRight: { ...row, gap: Spacing.xs },
  actionBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  bestBadge: { ...row, gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.xs },
  bestText: semibold,
  browseScroll: { flex: 1 },
  browseContent: { paddingBottom: Spacing["2xl"] },
  pagerWrap: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  scanBtn: { ...row, justifyContent: "center", gap: Spacing.sm, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, paddingVertical: Spacing.sm + 2, borderRadius: 50, borderWidth: 1 },
  scanBtnText: semibold,
  scanErrorText: { ...Typography.small, textAlign: "center", marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  startPracticeBtn: { ...row, justifyContent: "center", gap: Spacing.sm, marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, paddingVertical: Spacing.md, borderRadius: 50, minHeight: Spacing.buttonHeight, ...ClayShadow },
  startPracticeText: { ...Typography.subtitle, fontFamily: Fonts.bodyBold, fontWeight: "700" },
  practiceCard: { marginHorizontal: Spacing.lg, padding: Spacing.md, borderRadius: 32, ...ClayShadowSmall },
  quickActions: { ...row, gap: Spacing.sm, marginHorizontal: Spacing.lg, marginTop: Spacing.sm },
  quickActionBtn: { ...row, flex: 1, justifyContent: "center", gap: Spacing.xs, minHeight: 44, paddingVertical: Spacing.sm, borderRadius: 50, borderWidth: 1 },
  quickActionText: medium,
  browseSection: { paddingHorizontal: Spacing.lg, marginTop: Spacing.sm },
  sectionDivider: { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: Spacing.sm, marginHorizontal: Spacing.lg },
  sectionLabel: { ...row, gap: Spacing.xs, marginBottom: Spacing.xs },
  sectionLabelText: { ...semibold, fontFamily: Fonts.heading, textTransform: "uppercase", letterSpacing: 0.5 },
  recordingsHeader: { ...row, gap: Spacing.xs, marginBottom: Spacing.sm },
  recordingsCount: medium, sectionTitle: semibold,
  autoplayLoading: { ...row, justifyContent: "center", gap: Spacing.sm, padding: Spacing.lg, borderRadius: BorderRadius.md },
  autoplayLoadingText: { ...Typography.body },
  synthControls: { ...row, padding: Spacing.md, borderRadius: 32, gap: Spacing.md, marginTop: Spacing.sm, ...ClayShadowSmall },
  synthPlayButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  synthTrackSection: { flex: 1, gap: Spacing.xs },
  synthTrackBg: { height: 8, borderRadius: 4, overflow: "hidden" },
  synthTrackProgress: { height: "100%", borderRadius: 2 },
  synthTimeRow: { flexDirection: "row", justifyContent: "space-between" },
  synthTimeText: medium,
  tempoControl: { ...row, padding: Spacing.sm, borderRadius: BorderRadius.md, gap: Spacing.sm, marginTop: Spacing.xs },
  tempoLabel: { ...medium, flex: 1 },
  tempoStepper: { ...row, gap: Spacing.sm },
  tempoStepBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  tempoValue: { ...Typography.label, fontFamily: "Nunito_700Bold", fontWeight: "700", minWidth: 48, textAlign: "center" },
  instrumentRow: { ...row, padding: Spacing.sm, borderRadius: BorderRadius.md, gap: Spacing.sm, marginTop: Spacing.xs },
  instrumentButtons: { ...row, gap: Spacing.xs },
  instrumentBtnText: semibold,
});
