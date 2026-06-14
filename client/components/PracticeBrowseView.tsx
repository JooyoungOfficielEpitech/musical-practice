import React, { useState, useMemo, useCallback } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable,
  ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { SheetMusicPager } from "@/components/SheetMusicPager";
import { InteractiveScore } from "@/components/InteractiveScore";
import { RecordingsList } from "@/components/RecordingsList";
import { MetronomeBottomSheet } from "@/components/MetronomeBottomSheet";
import { AudioBottomSheet } from "@/components/AudioBottomSheet";
import { ScorePreviewEmpty } from "@/components/ScorePreviewEmpty";
import { ScorePreviewControls } from "@/components/ScorePreviewControls";
import { PartsSummaryBar } from "@/components/PartsSummaryBar";
import { PartCheckSheet } from "@/components/PartCheckSheet";
import { Spacing, BorderRadius, Typography, Fonts, ClayShadow, Colors } from "@/constants/theme";
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

interface ToolChipProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  onPress: () => void;
}

function ToolChip({ icon, label, active, onPress }: ToolChipProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        toolStyles.chip,
        { borderColor: active ? colors.primary : colors.borderLight, backgroundColor: active ? colors.primary : colors.surface, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Ionicons name={icon} size={16} color={active ? colors.buttonText : colors.primary} />
      <Text style={[toolStyles.chipText, { color: active ? colors.buttonText : colors.text }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function PracticeBrowseViewComponent({
  sheet, state, screenWidth, loading, onRefresh, onGoBack, removeRecording, renameRecording,
}: PracticeBrowseViewProps): React.JSX.Element {
  const { colors } = useTheme();
  const [metronomeVisible, setMetronomeVisible] = useState(false);
  const [audioVisible, setAudioVisible] = useState(false);
  const [partSheetVisible, setPartSheetVisible] = useState(false);

  const {
    currentBpm, setShowEdit, isStartingPractice, musicXmlContent, musicXmlLoading,
    hasMusicXml, setShowInstrumentPicker, editMode, setEditMode, bestScore,
    sheetRecordings, synthPlayer, noteEditor, omr, handleNotePress, handleSynthPlayPause,
    handleScanSheet, handleStartPractice, handleDeletePress,
    partInfos, partNoteCounts, visiblePartIds, togglePartVisibility,
  } = state;

  const visiblePartIndices = useMemo(
    () => partInfos.filter((p) => visiblePartIds.has(p.id)).map((p) => p.partIndex),
    [partInfos, visiblePartIds],
  );

  const handleStartPress = useCallback(() => {
    if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    handleStartPractice();
  }, [handleStartPractice]);

  const handleScanPress = useCallback(() => {
    if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    handleScanSheet();
  }, [handleScanSheet]);

  const startPracticeCta = (
    <Pressable onPress={handleStartPress} accessibilityLabel="Start practice session" accessibilityRole="button" accessibilityState={{ busy: isStartingPractice }}
      style={({ pressed }) => [styles.startPracticeBtn, { backgroundColor: isStartingPractice ? colors.textSecondary : colors.primaryDark, opacity: pressed && !isStartingPractice ? 0.9 : 1 }]}
      android_ripple={{ color: Colors.light.ripple, borderless: false }}
    >
      {isStartingPractice ? <ActivityIndicator size="small" color={colors.buttonText} /> : <Ionicons name="mic" size={20} color={colors.buttonText} />}
      <Text style={[styles.startPracticeText, { color: colors.buttonText }]}>{isStartingPractice ? "Preparing..." : "Start Practice"}</Text>
    </Pressable>
  );

  return (
    <>
      <View style={styles.topBar}>
        <Pressable onPress={onGoBack} accessibilityLabel="Go back" accessibilityRole="button" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.topBarTitle}>
          <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>{sheet.title}</Text>
          {!!sheet.artist && <Text style={[styles.subtitleText, { color: colors.textSecondary }]} numberOfLines={1}>{sheet.artist}</Text>}
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

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {hasMusicXml ? (
          <>
            {/* Parts summary — opens the full part-check sheet */}
            <PartsSummaryBar parts={partInfos} visiblePartIds={visiblePartIds} onPress={() => setPartSheetVisible(true)} />

            {/* Score hero */}
            <View style={styles.heroWrap}>
              {musicXmlLoading ? (
                <View style={[styles.heroLoading, { backgroundColor: colors.surface }]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.heroLoadingText, { color: colors.textSecondary }]}>Loading score...</Text>
                </View>
              ) : musicXmlContent ? (
                <View style={styles.hero}>
                  <InteractiveScore
                    musicXml={noteEditor.editedMusicXml || musicXmlContent}
                    positionMs={synthPlayer.positionMs * synthPlayer.tempo}
                    visiblePartIndices={visiblePartIndices}
                    onNotePress={editMode ? noteEditor.selectNote : handleNotePress}
                  />
                </View>
              ) : (
                <View style={[styles.heroLoading, { backgroundColor: colors.surface }]}>
                  <Ionicons name="alert-circle-outline" size={20} color={colors.textSecondary} />
                  <Text style={[styles.heroLoadingText, { color: colors.textSecondary }]}>Failed to load score</Text>
                </View>
              )}
            </View>

            {/* Transport — listen (synth) */}
            {musicXmlContent && (
              <View style={styles.transport}>
                <ScorePreviewControls
                  compact
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
                {/* Compact tools */}
                <View style={styles.tools}>
                  <ToolChip icon="create-outline" label={editMode ? "Editing" : "Edit"} active={editMode} onPress={() => setEditMode((prev) => !prev)} />
                  <ToolChip icon="musical-note-outline" label="Sound" onPress={() => setShowInstrumentPicker(true)} />
                  <ToolChip icon="timer-outline" label="Metronome" onPress={() => setMetronomeVisible(true)} />
                  {sheet.audioUri && <ToolChip icon="headset-outline" label="Audio" onPress={() => setAudioVisible(true)} />}
                </View>
              </View>
            )}

            {/* Primary action */}
            {startPracticeCta}
            <Text style={[styles.caption, { color: colors.textSecondary }]}>Start Practice for live mic pitch feedback and session tracking.</Text>
          </>
        ) : (
          <>
            <View style={styles.pagerWrap}>
              {sheet.imageUris.length > 0 ? <SheetMusicPager imageUris={sheet.imageUris} /> : <ScorePreviewEmpty />}
            </View>
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
            <View style={[styles.tools, styles.toolsInset]}>
              <ToolChip icon="timer-outline" label="Metronome" onPress={() => setMetronomeVisible(true)} />
              {sheet.audioUri && <ToolChip icon="headset-outline" label="Audio" onPress={() => setAudioVisible(true)} />}
            </View>
            {startPracticeCta}
          </>
        )}

        {/* Recordings */}
        <View style={[styles.sectionDivider, { borderTopColor: colors.separator }]} />
        <View style={styles.section}>
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
      <PartCheckSheet
        visible={partSheetVisible}
        onDismiss={() => setPartSheetVisible(false)}
        parts={partInfos}
        partNoteCounts={partNoteCounts}
        visiblePartIds={visiblePartIds}
        onTogglePart={togglePartVisibility}
      />
    </>
  );
}

export const PracticeBrowseView = React.memo(PracticeBrowseViewComponent);

const row = { flexDirection: "row" as const, alignItems: "center" as const };
const semibold = { ...Typography.label, fontFamily: "Nunito_600SemiBold" as const, fontWeight: "600" as const };
const medium = { ...Typography.label, fontFamily: "Nunito_500Medium" as const, fontWeight: "500" as const };

const toolStyles = StyleSheet.create({
  chip: { ...row, gap: Spacing.xs, paddingVertical: Spacing.xs + 2, paddingHorizontal: Spacing.sm + 2, borderRadius: 50, borderWidth: 1, minHeight: 36 },
  chipText: medium,
});

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
  scroll: { flex: 1 },
  content: { paddingBottom: Spacing["2xl"] },
  heroWrap: { marginHorizontal: Spacing.lg, marginTop: Spacing.sm },
  hero: { height: 360, borderRadius: BorderRadius.md, overflow: "hidden", ...ClayShadow },
  heroLoading: { ...row, justifyContent: "center", gap: Spacing.sm, height: 120, borderRadius: BorderRadius.md },
  heroLoadingText: { ...Typography.body },
  transport: { marginHorizontal: Spacing.lg, marginTop: Spacing.sm },
  tools: { ...row, flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.sm },
  toolsInset: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  startPracticeBtn: { ...row, justifyContent: "center", gap: Spacing.sm, marginHorizontal: Spacing.lg, marginTop: Spacing.md, paddingVertical: Spacing.md, borderRadius: 50, minHeight: Spacing.buttonHeight, ...ClayShadow },
  startPracticeText: { ...Typography.subtitle, fontFamily: Fonts.bodyBold, fontWeight: "700" },
  caption: { ...Typography.small, textAlign: "center", marginTop: Spacing.xs, marginHorizontal: Spacing.lg },
  pagerWrap: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  scanBtn: { ...row, justifyContent: "center", gap: Spacing.sm, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, paddingVertical: Spacing.sm + 2, borderRadius: 50, borderWidth: 1 },
  scanBtnText: semibold,
  scanErrorText: { ...Typography.small, textAlign: "center", marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  sectionDivider: { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: Spacing.md, marginHorizontal: Spacing.lg },
  section: { paddingHorizontal: Spacing.lg },
  recordingsHeader: { ...row, gap: Spacing.xs, marginBottom: Spacing.sm },
  recordingsCount: medium, sectionTitle: semibold,
});
