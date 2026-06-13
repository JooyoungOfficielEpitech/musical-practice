import React, { useState, useCallback } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable,
  ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { SheetMusicPager } from "@/components/SheetMusicPager";
import { PitchPanel } from "@/components/PitchPanel";
import { InteractiveScore } from "@/components/InteractiveScore";
import { RecordingsList } from "@/components/RecordingsList";
import { MetronomeBottomSheet } from "@/components/MetronomeBottomSheet";
import { AudioBottomSheet } from "@/components/AudioBottomSheet";
import { ScorePreviewEmpty } from "@/components/ScorePreviewEmpty";
import { ScorePreviewControls } from "@/components/ScorePreviewControls";
import { PartCheckCard } from "@/components/PartCheckCard";
import { Spacing, BorderRadius, Typography, Shadows, Fonts, ClayShadow, ClayShadowSmall, Colors } from "@/constants/theme";
import type { SheetMusic } from "@/lib/storage";
import type { PracticeDetailState } from "@/hooks/usePracticeDetail";
import type { Recording } from "@/lib/audio/types";

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

function PracticeBrowseViewComponent({
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
    partInfos, partNoteCounts, visiblePartIds, togglePartVisibility,
  } = state;

  const handleScanPress = useCallback(() => {
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    handleScanSheet();
  }, [handleScanSheet]);

  const handleStartPress = useCallback(() => {
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    handleStartPractice();
  }, [handleStartPractice]);

  const handleMetronomePress = useCallback(() => {
    setMetronomeVisible(true);
  }, []);

  const handleAudioPress = useCallback(() => {
    setAudioVisible(true);
  }, []);

  return (
    <>
      <View style={styles.topBar}>
        <Pressable onPress={onGoBack} accessibilityLabel="Go back" accessibilityRole="button" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.topBarTitle}>
          <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>{sheet.title}</Text>
          <Text style={[styles.subtitleText, { color: colors.textSecondary }]} numberOfLines={1}>{sheet.artist}</Text>
        </View>
        <View style={styles.topBarRight}>
          <Pressable onPress={() => setShowEdit(true)} accessibilityLabel="Edit score" accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="create-outline" size={22} color={colors.text} />
          </Pressable>
          <Pressable onPress={handleDeletePress} accessibilityLabel="Delete score" accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}>
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
          <Pressable onPress={handleScanPress} accessibilityLabel="Scan sheet music for auto-play" accessibilityRole="button" accessibilityState={{ busy: omr.isProcessing }}
            style={({ pressed }) => [styles.scanBtn, { backgroundColor: omr.isProcessing ? colors.backgroundSecondary : colors.surface, borderColor: colors.primary, opacity: pressed && !omr.isProcessing ? 0.8 : 1 }]}
            android_ripple={{ color: Colors.light.ripple, borderless: false }}
          >
            {omr.isProcessing ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="scan-outline" size={18} color={colors.primary} />}
            <Text style={[styles.scanBtnText, { color: colors.primary }]}>{omr.isProcessing ? "Scanning..." : omr.error ? "Retry Scan" : "Scan Sheet Music"}</Text>
          </Pressable>
        )}
        {omr.error && sheet.omrStatus !== "ready" && <Text style={[styles.scanErrorText, { color: colors.error }]}>{omr.error}</Text>}

        {/* Part check (성부 확인) — confirm/select voices before practicing */}
        <PartCheckCard
          parts={partInfos}
          visiblePartIds={visiblePartIds}
          partNoteCounts={partNoteCounts}
          onTogglePart={togglePartVisibility}
        />

        {/* Start Practice CTA */}
        <Pressable onPress={handleStartPress} accessibilityLabel="Start practice session" accessibilityRole="button" accessibilityState={{ busy: isStartingPractice }}
          style={({ pressed }) => [styles.startPracticeBtn, { backgroundColor: isStartingPractice ? colors.textSecondary : colors.primaryDark, opacity: pressed && !isStartingPractice ? 0.9 : 1 }]}
          android_ripple={{ color: Colors.light.ripple, borderless: false }}
        >
          {isStartingPractice ? <ActivityIndicator size="small" color={colors.buttonText} /> : <Ionicons name="play" size={22} color={colors.buttonText} />}
          <Text style={[styles.startPracticeText, { color: colors.buttonText }]}>{isStartingPractice ? "Preparing..." : "Start Practice"}</Text>
        </Pressable>

        {/* Pitch panel */}
        <View style={[styles.practiceCard, { backgroundColor: colors.surface }, Shadows.sm]}>
          <PitchPanel width={screenWidth - Spacing.lg * 2} isListening={isListening} currentPitch={currentPitch} accuracy={sessionAccuracy} error={pitchError} isRecording={isRecording} />
        </View>

        <View style={styles.quickActions}>
          <Pressable onPress={handleMetronomePress} accessibilityLabel="Open metronome" accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [styles.quickActionBtn, { borderColor: colors.borderLight, opacity: pressed ? 0.9 : 1 }]}>
            <Ionicons name="musical-note-outline" size={16} color={colors.primary} />
            <Text style={[styles.quickActionText, { color: colors.primary }]}>Metronome</Text>
          </Pressable>
          {sheet.audioUri && (
            <Pressable onPress={handleAudioPress} accessibilityLabel="Open audio player" accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => [styles.quickActionBtn, { borderColor: colors.borderLight, opacity: pressed ? 0.9 : 1 }]}>
              <Ionicons name="headset-outline" size={16} color={colors.primary} />
              <Text style={[styles.quickActionText, { color: colors.primary }]}>Reference Audio</Text>
            </Pressable>
          )}
        </View>

        {/* Score Preview section */}
        {hasMusicXml ? (
          <View style={styles.browseSection}>
            <View style={styles.sectionLabel}><Ionicons name="play-circle-outline" size={14} color={colors.primary} /><Text style={[styles.sectionLabelText, { color: colors.primary }]}>Score Preview</Text></View>
            {musicXmlLoading ? (
              <View style={[styles.autoplayLoading, { backgroundColor: colors.surface }]}><ActivityIndicator size="small" color={colors.primary} /><Text style={[styles.autoplayLoadingText, { color: colors.textSecondary }]}>Loading score...</Text></View>
            ) : musicXmlContent ? (
              <>
                <InteractiveScore musicXml={noteEditor.editedMusicXml || musicXmlContent} positionMs={synthPlayer.positionMs * synthPlayer.tempo} onNotePress={editMode ? noteEditor.selectNote : handleNotePress} />
                <ScorePreviewControls
                  isPlaying={synthPlayer.isPlaying}
                  positionMs={synthPlayer.positionMs}
                  durationMs={synthPlayer.durationMs}
                  tempo={synthPlayer.tempo}
                  onTempoChange={synthPlayer.setTempo}
                  instrument={synthPlayer.instrument}
                  instrumentLoading={synthPlayer.instrumentLoading}
                  onPlayPause={handleSynthPlayPause}
                  editMode={editMode}
                  onToggleEdit={() => setEditMode((prev) => !prev)}
                  hasEdits={noteEditor.hasEdits}
                  onOpenInstrumentPicker={() => setShowInstrumentPicker(true)}
                />
              </>
            ) : (
              <View style={[styles.autoplayLoading, { backgroundColor: colors.surface }]}><Ionicons name="alert-circle-outline" size={20} color={colors.textSecondary} /><Text style={[styles.autoplayLoadingText, { color: colors.textSecondary }]}>Failed to load score</Text></View>
            )}
          </View>
        ) : (
          <ScorePreviewEmpty />
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

export const PracticeBrowseView = React.memo(PracticeBrowseViewComponent);

const row = { flexDirection: "row" as const, alignItems: "center" as const };
const semibold = { ...Typography.label, fontFamily: "Nunito_600SemiBold" as const, fontWeight: "600" as const };
const medium = { ...Typography.label, fontFamily: "Nunito_500Medium" as const, fontWeight: "500" as const };

const styles = StyleSheet.create({
  topBar: { ...row, height: 56, paddingHorizontal: Spacing.lg, gap: Spacing.sm + 2 },
  backBtn: { width: 44, height: 44, borderRadius: BorderRadius.sm, alignItems: "center", justifyContent: "center" },
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
});
