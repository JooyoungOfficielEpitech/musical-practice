import React, { useState, useMemo, useCallback } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable,
  ActivityIndicator, RefreshControl, Platform, useWindowDimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { SheetMusicPager } from "@/components/SheetMusicPager";
import { InteractiveScore } from "@/components/InteractiveScore";
import { MetronomeBottomSheet } from "@/components/MetronomeBottomSheet";
import { AudioBottomSheet } from "@/components/AudioBottomSheet";
import { ScorePreviewEmpty } from "@/components/ScorePreviewEmpty";
import { ScorePreviewControls } from "@/components/ScorePreviewControls";
import { LoopControls } from "@/components/LoopControls";
import { PartsSummaryBar } from "@/components/PartsSummaryBar";
import { PartCheckSheet } from "@/components/PartCheckSheet";
import { ScoreSettingsSheet } from "@/components/ScoreSettingsSheet";
import { ScoreFullscreenModal } from "@/components/ScoreFullscreenModal";
import { makeLoopRange } from "@/lib/audio/transportMath";
import { Spacing, BorderRadius, Typography, Fonts, ClayShadow, Colors } from "@/constants/theme";
import type { SheetMusic } from "@/lib/storage";
import type { PracticeDetailState } from "@/hooks/usePracticeDetail";

export interface PracticeBrowseViewProps {
  sheet: SheetMusic;
  state: PracticeDetailState;
  screenWidth: number;
  loading: boolean;
  onRefresh: () => void;
  onGoBack: () => void;
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
  sheet, state, screenWidth, loading, onRefresh, onGoBack,
}: PracticeBrowseViewProps): React.JSX.Element {
  const { colors } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const [metronomeVisible, setMetronomeVisible] = useState(false);
  const [audioVisible, setAudioVisible] = useState(false);
  const [partSheetVisible, setPartSheetVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [editBtnFocused, setEditBtnFocused] = useState(false);
  const [deleteBtnFocused, setDeleteBtnFocused] = useState(false);
  const [loopPointA, setLoopPointA] = useState<number | null>(null);
  const [loopPointB, setLoopPointB] = useState<number | null>(null);
  const [isLoopActive, setIsLoopActive] = useState(false);

  // Hero ~42% of the viewport, clamped so it never crowds out the CTA or shrinks
  // to uselessness on small/large devices.
  const heroHeight = Math.round(Math.min(420, Math.max(240, screenHeight * 0.42)));

  const {
    currentBpm, setShowEdit, isStartingPractice, musicXmlContent, musicXmlLoading,
    hasMusicXml, setShowInstrumentPicker, editMode, setEditMode,
    synthPlayer, noteEditor, omr, handleNotePress, handleSynthPlayPause,
    handleScanSheet, handleStartPractice, handleDeletePress,
    partInfos, partNoteCounts, visiblePartIds, togglePartVisibility,
    isPracticing,
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

  const handlePartSheetToggle = useCallback(() => {
    setPartSheetVisible(true);
  }, []);

  const handleMetronomeToggle = useCallback(() => {
    setMetronomeVisible(true);
  }, []);

  const handleAudioToggle = useCallback(() => {
    setAudioVisible(true);
  }, []);

  const handleSettingsToggle = useCallback(() => {
    setSettingsVisible(true);
  }, []);

  const handleFullscreenToggle = useCallback(() => {
    setFullscreenVisible(true);
  }, []);

  const handleCaptureLoopPointA = useCallback((ms: number) => {
    setLoopPointA(ms);
  }, []);

  const handleCaptureLoopPointB = useCallback(
    (ms: number) => {
      setLoopPointB(ms);
      // Auto-arm loop if valid range
      const range = makeLoopRange(loopPointA, ms, synthPlayer.durationMs);
      if (range && !isLoopActive) {
        synthPlayer.setLoopRange(range);
        setIsLoopActive(true);
      }
    },
    [loopPointA, isLoopActive, synthPlayer]
  );

  const handleApplyLoop = useCallback(() => {
    if (loopPointA !== null && loopPointB !== null) {
      const range = makeLoopRange(loopPointA, loopPointB, synthPlayer.durationMs);
      if (range) {
        synthPlayer.setLoopRange(range);
        setIsLoopActive(true);
      }
    }
  }, [loopPointA, loopPointB, synthPlayer]);

  const handleClearLoop = useCallback(() => {
    setLoopPointA(null);
    setLoopPointB(null);
    setIsLoopActive(false);
    synthPlayer.clearLoopRange();
  }, [synthPlayer]);

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
        <Pressable onPress={onGoBack} accessibilityLabel="Go back to library" accessibilityRole="button" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.topBarTitle}>
          <Text style={[styles.modeLabel, { color: isPracticing ? colors.primary : colors.textSecondary }]}>{isPracticing ? "PRACTICE" : "LISTEN & REVIEW"}</Text>
          <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>{sheet.title}</Text>
          {!!sheet.artist && <Text style={[styles.subtitleText, { color: colors.textSecondary }]} numberOfLines={1}>{sheet.artist}</Text>}
        </View>
        <View style={styles.topBarRight}>
          <Pressable
          onPress={() => setShowEdit(true)}
          onFocus={() => setEditBtnFocused(true)}
          onBlur={() => setEditBtnFocused(false)}
          accessibilityLabel="Edit score"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1, borderWidth: editBtnFocused ? 2 : 0, borderColor: editBtnFocused ? colors.primary : "transparent" }]}
        >
          <Ionicons name="create-outline" size={22} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={handleDeletePress}
          onFocus={() => setDeleteBtnFocused(true)}
          onBlur={() => setDeleteBtnFocused(false)}
          accessibilityLabel="Delete score"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1, borderWidth: deleteBtnFocused ? 2 : 0, borderColor: deleteBtnFocused ? colors.primary : "transparent" }]}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </Pressable>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {hasMusicXml ? (
          <>
            {/* Parts summary — opens the full part-check sheet */}
            <PartsSummaryBar parts={partInfos} visiblePartIds={visiblePartIds} onPress={handlePartSheetToggle} />

            {/* Score hero */}
            <View style={styles.heroWrap}>
              {musicXmlLoading ? (
                <View style={[styles.heroLoading, { backgroundColor: colors.surface }]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.heroLoadingText, { color: colors.textSecondary }]}>Loading score...</Text>
                </View>
              ) : musicXmlContent ? (
                <View style={[styles.hero, { height: heroHeight }]}>
                  <InteractiveScore
                    musicXml={noteEditor.editedMusicXml || musicXmlContent}
                    positionMs={synthPlayer.positionMs * synthPlayer.tempo}
                    visiblePartIndices={visiblePartIndices}
                    onNotePress={editMode ? noteEditor.selectNote : handleNotePress}
                  />
                  <Pressable
                    onPress={handleFullscreenToggle}
                    accessibilityLabel="Expand score to fullscreen"
                    accessibilityRole="button"
                    hitSlop={8}
                    style={[styles.expandBtn, { backgroundColor: colors.surface }]}
                  >
                    <Ionicons name="expand" size={18} color={colors.text} />
                  </Pressable>
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
                {!isPracticing && (
                  <View style={styles.listenLabel}>
                    <Ionicons name="headset-outline" size={13} color={colors.textSecondary} />
                    <Text style={[styles.listenLabelText, { color: colors.textSecondary }]}>LISTEN</Text>
                  </View>
                )}
                {partInfos.length > 1 && (
                  <View style={styles.partsLabel}>
                    <Ionicons name="people-outline" size={13} color={colors.textSecondary} />
                    <Text style={[styles.partsLabelText, { color: colors.textSecondary }]}>PARTS: Choose which voices to practice with</Text>
                  </View>
                )}
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
                  loopRange={synthPlayer.loopRange}
                  onSeek={synthPlayer.seekTo}
                />
                <LoopControls
                  loopPointA={loopPointA}
                  loopPointB={loopPointB}
                  isLoopActive={isLoopActive}
                  positionMs={synthPlayer.positionMs}
                  durationMs={synthPlayer.durationMs}
                  onCaptureA={handleCaptureLoopPointA}
                  onCaptureB={handleCaptureLoopPointB}
                  onApply={handleApplyLoop}
                  onClear={handleClearLoop}
                />
                {/* Compact tools — frequent actions visible; edit/sound in settings */}
                <View style={styles.tools}>
                  <ToolChip icon="timer-outline" label="Metronome" onPress={handleMetronomeToggle} />
                  {sheet.audioUri && <ToolChip icon="headset-outline" label="Audio" onPress={handleAudioToggle} />}
                  <ToolChip icon="options-outline" label="Settings" onPress={handleSettingsToggle} />
                </View>
              </View>
            )}

            {/* Primary action — hidden during a live session (the session bar owns stop) */}
            {!isPracticing && (
              <>
                {startPracticeCta}
                <Text style={[styles.caption, { color: colors.textSecondary }]}>Play along with the score.</Text>
              </>
            )}
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
              <ToolChip icon="timer-outline" label="Metronome" onPress={handleMetronomeToggle} />
              {sheet.audioUri && <ToolChip icon="headset-outline" label="Audio" onPress={handleAudioToggle} />}
            </View>
            {startPracticeCta}
          </>
        )}
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
      <ScoreSettingsSheet
        visible={settingsVisible}
        onDismiss={() => setSettingsVisible(false)}
        editMode={editMode}
        onToggleEdit={() => setEditMode((prev) => !prev)}
        hasEdits={noteEditor.hasEdits}
        instrument={synthPlayer.instrument}
        instrumentLoading={synthPlayer.instrumentLoading}
        onOpenInstrumentPicker={() => { setSettingsVisible(false); setShowInstrumentPicker(true); }}
      />
      {musicXmlContent && (
        <ScoreFullscreenModal
          visible={fullscreenVisible}
          onClose={() => setFullscreenVisible(false)}
          musicXml={noteEditor.editedMusicXml || musicXmlContent}
          positionMs={synthPlayer.positionMs * synthPlayer.tempo}
          visiblePartIndices={visiblePartIndices}
          isPlaying={synthPlayer.isPlaying}
          onPlayPause={handleSynthPlayPause}
        />
      )}
    </>
  );
}

export const PracticeBrowseView = React.memo(PracticeBrowseViewComponent);

const row = { flexDirection: "row" as const, alignItems: "center" as const };
const semibold = { ...Typography.label, fontFamily: "Nunito_600SemiBold" as const, fontWeight: "600" as const };
const medium = { ...Typography.label, fontFamily: "Nunito_500Medium" as const, fontWeight: "500" as const };

const toolStyles = StyleSheet.create({
  chip: { ...row, gap: Spacing.xs, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm + 2, borderRadius: 50, borderWidth: 1, minHeight: 44 },
  chipText: medium,
});

const styles = StyleSheet.create({
  topBar: { ...row, height: 56, paddingHorizontal: Spacing.lg, gap: Spacing.sm + 2 },
  backBtn: { width: 44, height: 44, borderRadius: BorderRadius.sm, alignItems: "center", justifyContent: "center" },
  topBarTitle: { flex: 1 },
  modeLabel: { ...Typography.small, fontFamily: Fonts.heading, fontWeight: "600", letterSpacing: 1, marginBottom: Spacing.xs },
  titleText: { ...Typography.subtitle, fontFamily: Fonts.heading, fontSize: 18 },
  subtitleText: { ...Typography.small },
  topBarRight: { ...row, gap: Spacing.xs },
  actionBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  bestBadge: { ...row, gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.xs },
  bestText: semibold,
  scroll: { flex: 1 },
  content: { paddingBottom: Spacing["2xl"] },
  heroWrap: { marginHorizontal: Spacing.lg, marginTop: Spacing.sm },
  hero: { borderRadius: BorderRadius.md, overflow: "hidden", ...ClayShadow },
  expandBtn: { position: "absolute", top: Spacing.sm, right: Spacing.sm, width: 44, height: 44, borderRadius: BorderRadius.full, alignItems: "center", justifyContent: "center", ...ClayShadow },
  heroLoading: { ...row, justifyContent: "center", gap: Spacing.sm, height: 120, borderRadius: BorderRadius.md },
  heroLoadingText: { ...Typography.body },
  transport: { marginHorizontal: Spacing.lg, marginTop: Spacing.sm },
  listenLabel: { ...row, gap: Spacing.xs, marginBottom: Spacing.xs, marginLeft: Spacing.xs },
  listenLabelText: { ...Typography.small, fontFamily: Fonts.heading, fontWeight: "600", letterSpacing: 1 },
  partsLabel: { ...row, gap: Spacing.xs, marginBottom: Spacing.sm, marginLeft: Spacing.xs },
  partsLabelText: { ...Typography.small, fontFamily: Fonts.heading, fontWeight: "600", letterSpacing: 0.5 },
  tools: { ...row, flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.sm },
  toolsInset: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  startPracticeBtn: { ...row, justifyContent: "center", gap: Spacing.sm, marginHorizontal: Spacing.lg, marginTop: Spacing.md, paddingVertical: Spacing.md, borderRadius: 50, minHeight: Spacing.buttonHeight, ...ClayShadow },
  startPracticeText: { ...Typography.subtitle, fontFamily: Fonts.bodyBold, fontWeight: "700" },
  caption: { ...Typography.small, textAlign: "center", marginTop: Spacing.xs, marginHorizontal: Spacing.lg },
  pagerWrap: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  scanBtn: { ...row, justifyContent: "center", gap: Spacing.sm, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, paddingVertical: Spacing.sm + 2, borderRadius: 50, borderWidth: 1 },
  scanBtnText: semibold,
  scanErrorText: { ...Typography.small, textAlign: "center", marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
});
