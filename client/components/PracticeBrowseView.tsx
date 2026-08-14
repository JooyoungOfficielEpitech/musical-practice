import React, { useState, useMemo, useCallback } from "react";
import {
  StyleSheet, Text, View, ScrollView, Pressable,
  RefreshControl, useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { hapticFeedback } from "@/lib/hapticFeedback";
import { InteractiveScore } from "@/components/InteractiveScore";
import { PartCheckSheet } from "@/components/PartCheckSheet";
import { PracticeTopBar } from "@/components/PracticeTopBar";
import { PlaybackTransport } from "@/components/PlaybackTransport";
import { PracticeToolsRow } from "@/components/PracticeToolsRow";
import { PracticeStateView } from "@/components/PracticeStateViews";
import { NoteEditSheet } from "@/components/NoteEditSheet";
import { SessionCompleteToast } from "@/components/SessionCompleteToast";
import { ScoreFullscreenModal } from "@/components/ScoreFullscreenModal";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { useSmoothProgress } from "@/hooks/useSmoothProgress";
import { Spacing, BorderRadius, Typography, Fonts } from "@/constants/theme";
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

function PracticeBrowseViewComponent({
  sheet, state, screenWidth, loading, onRefresh, onGoBack,
}: PracticeBrowseViewProps): React.JSX.Element {
  const { colors } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const [partSheetVisible, setPartSheetVisible] = useState(false);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);

  const heroHeight = Math.round(Math.min(420, Math.max(240, screenHeight * 0.42)));
  const smoothProgress = useSmoothProgress(
    sheet.omrProgress ?? 0,
    sheet.omrStatus === "processing",
  );

  const {
    setShowEdit, musicXmlContent, musicXmlLoading,
    hasMusicXml, scoreBpm, synthPlayer, handleNotePress, handleSynthPlayPause,
    handleDeletePress,
    playback, loop, soloPart, extras, omrRetrying, handleRetryOmr,
    partInfos, partNoteCounts, visiblePartIds, togglePartVisibility,
  } = state;

  const visiblePartIndices = useMemo(
    () => partInfos.filter((p) => visiblePartIds.has(p.id)).map((p) => p.partIndex),
    [partInfos, visiblePartIds],
  );

  const handleFullscreenToggle = useCallback(() => {
    setFullscreenVisible(true);
  }, []);

  const handleRetryPress = useCallback(() => {
    void hapticFeedback.triggerMedium();
    handleRetryOmr().catch(() => {});
  }, [handleRetryOmr]);

  return (
    <>
      <PracticeTopBar
        title={sheet.title}
        artist={sheet.artist}
        onGoBack={onGoBack}
        onEdit={() => setShowEdit(true)}
        onDelete={handleDeletePress}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {hasMusicXml ? (
          <>
            {/* Score display */}
            <View style={styles.heroWrap}>
              {musicXmlLoading ? (
                <LoadingSkeleton height={heroHeight} label="Loading score…" />
              ) : musicXmlContent ? (
                <>
                  <View style={[styles.hero, { height: heroHeight }]}>
                    <InteractiveScore
                      musicXml={musicXmlContent}
                      positionMs={synthPlayer.positionMs * synthPlayer.tempo}
                      tempoBpm={scoreBpm ?? undefined}
                      visiblePartIndices={visiblePartIndices}
                      onNotePress={handleNotePress}
                    />
                    <Pressable
                      onPress={handleFullscreenToggle}
                      accessibilityLabel="Expand score to fullscreen"
                      accessibilityRole="button"
                      android_ripple={{ color: colors.ripple, borderless: true }}
                      hitSlop={8}
                      style={[styles.expandBtn, { backgroundColor: colors.surface }]}
                    >
                      <Ionicons name="expand" size={18} color={colors.text} />
                    </Pressable>
                  </View>
                  <View style={styles.disclaimerRow}>
                    <Ionicons name="information-circle-outline" size={13} color={colors.textSecondary} />
                    <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
                      Auto-scanned — a few notes may differ from the print
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.errorStateWrap}>
                  <ErrorState
                    title="Failed to load score"
                    message="The score could not be parsed. Try re-importing the PDF."
                    retryLabel="Reload"
                    onRetry={onRefresh}
                    retrying={loading}
                    icon="alert-circle-outline"
                  />
                </View>
              )}
            </View>

            {/* Playback controls */}
            {musicXmlContent && (
              <View style={styles.transport}>
                <Text style={[styles.transportLabel, { color: colors.textSecondary }]}>PLAYBACK</Text>
                <PlaybackTransport
                  synthPlayer={synthPlayer}
                  onPlayPause={handleSynthPlayPause}
                  transpose={playback.transpose}
                  onTransposeChange={playback.setTranspose}
                  metronomeOn={playback.metronomeOn}
                  onToggleMetronome={playback.toggleMetronome}
                  loopArmed={loop.armed}
                  onLoopPress={loop.handleLoopButton}
                />
                {loop.armed && (
                  <Text style={[styles.loopHint, { color: colors.primary }]}>
                    Tap two notes on the score to set the loop
                  </Text>
                )}
              </View>
            )}

            {musicXmlContent && <PracticeToolsRow extras={extras} />}

            {/* Part selection */}
            {partInfos.length > 1 && (
              <View style={styles.partsSection}>
                <Pressable
                  onPress={() => {
                    void hapticFeedback.triggerMedium();
                    setPartSheetVisible(true);
                  }}
                  style={({ pressed }) => [styles.partsButton, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
                  accessibilityRole="button"
                  accessibilityLabel="Select parts to practice"
                  android_ripple={{ color: colors.rippleLight }}
                >
                  <Ionicons name="people-outline" size={18} color={colors.buttonText} />
                  <Text style={[styles.partsButtonText, { color: colors.buttonText }]}>
                    Select Parts ({visiblePartIds.size}/{partInfos.length})
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        ) : (
          <PracticeStateView
            omrStatus={sheet.omrStatus}
            smoothProgress={smoothProgress}
            omrRetrying={omrRetrying}
            onRetry={handleRetryPress}
          />
        )}
      </ScrollView>

      {extras.sessionToast.visible && (
        <View style={styles.toastWrap} pointerEvents="none">
          <SessionCompleteToast
            durationSec={extras.sessionToast.durationSec}
            accuracy={extras.sessionToast.accuracy}
          />
        </View>
      )}

      {/* Modals */}
      <PartCheckSheet
        visible={partSheetVisible}
        parts={partInfos}
        partNoteCounts={partNoteCounts}
        visiblePartIds={visiblePartIds}
        onTogglePart={togglePartVisibility}
        partVolumes={playback.partVolumes}
        onVolumeChange={playback.setPartVolume}
        onSoloPart={soloPart}
        onDismiss={() => setPartSheetVisible(false)}
      />

      <NoteEditSheet
        visible={!!extras.editor.selectedNote}
        selectedPitch={extras.editor.selectedPitch}
        selectedLyric={extras.editor.selectedLyric}
        canEdit={extras.editor.canEditSelected === true}
        onApply={(step, alter, octave) => {
          extras.editor.applyPitch(step, alter, octave);
        }}
        onApplyLyric={(text) => {
          extras.editor.applyLyric(text);
        }}
        onDismiss={extras.editor.dismiss}
      />

      <ScoreFullscreenModal
        visible={fullscreenVisible}
        musicXml={musicXmlContent ?? ""}
        positionMs={synthPlayer.positionMs * synthPlayer.tempo}
        tempoBpm={scoreBpm ?? undefined}
        visiblePartIndices={visiblePartIndices}
        isPlaying={synthPlayer.isPlaying}
        onPlayPause={handleSynthPlayPause}
        onNotePress={handleNotePress}
        onClose={() => setFullscreenVisible(false)}
      />
    </>
  );
}

export const PracticeBrowseView = React.memo(PracticeBrowseViewComponent);

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 100 },
  heroWrap: { marginHorizontal: Spacing.lg, marginVertical: Spacing.md },
  hero: { borderRadius: BorderRadius.md, overflow: "hidden", position: "relative" },
  errorStateWrap: { marginVertical: Spacing.lg },
  expandBtn: { position: "absolute", bottom: Spacing.md, right: Spacing.md, width: 44, height: 44, borderRadius: BorderRadius.sm, alignItems: "center", justifyContent: "center" },
  disclaimerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.xs, paddingHorizontal: Spacing.xs },
  disclaimerText: { ...Typography.small, fontSize: 11, flex: 1 },
  transport: { paddingHorizontal: 0, marginVertical: Spacing.md },
  transportLabel: { ...Typography.label, marginBottom: Spacing.xs, paddingHorizontal: Spacing.lg },
  loopHint: { ...Typography.small, textAlign: "center", marginTop: Spacing.xs },
  toastWrap: { position: "absolute", bottom: Spacing["2xl"], left: 0, right: 0, alignItems: "center" },
  partsSection: { paddingHorizontal: Spacing.lg, marginVertical: Spacing.lg },
  partsButton: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  partsButtonText: { ...Typography.body, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
});
