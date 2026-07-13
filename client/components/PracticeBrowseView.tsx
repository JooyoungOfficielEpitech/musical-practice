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
  const [editBtnFocused, setEditBtnFocused] = useState(false);
  const [deleteBtnFocused, setDeleteBtnFocused] = useState(false);

  const heroHeight = Math.round(Math.min(420, Math.max(240, screenHeight * 0.42)));
  const smoothProgress = useSmoothProgress(
    sheet.omrProgress ?? 0,
    sheet.omrStatus === "processing",
  );

  const {
    setShowEdit, musicXmlContent, musicXmlLoading,
    hasMusicXml, synthPlayer, handleNotePress, handleSynthPlayPause,
    handleDeletePress,
    partInfos, partNoteCounts, visiblePartIds, togglePartVisibility, noteSequence,
  } = state;

  const visiblePartIndices = useMemo(
    () => partInfos.filter((p) => visiblePartIds.has(p.id)).map((p) => p.partIndex),
    [partInfos, visiblePartIds],
  );

  const handleFullscreenToggle = useCallback(() => {
    setFullscreenVisible(true);
  }, []);

  return (
    <>
      <View style={styles.topBar}>
        <Pressable onPress={onGoBack} accessibilityLabel="Go back to library" accessibilityRole="button" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.topBarTitle}>
          <Text style={[styles.modeLabel, { color: colors.textSecondary }]}>SCORE + LISTEN</Text>
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
            {/* Score display */}
            <View style={styles.heroWrap}>
              {musicXmlLoading ? (
                <LoadingSkeleton height={heroHeight} />
              ) : musicXmlContent ? (
                <View style={[styles.hero, { height: heroHeight }]}>
                  <InteractiveScore
                    musicXml={musicXmlContent}
                    positionMs={synthPlayer.positionMs * synthPlayer.tempo}
                    visiblePartIndices={visiblePartIndices}
                    onNotePress={handleNotePress}
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
                <View style={styles.errorStateWrap}>
                  <ErrorState
                    title="Failed to load score"
                    message="The score could not be parsed. Try re-importing the PDF."
                    retryLabel="Reload"
                    onRetry={onRefresh}
                    icon="alert-circle-outline"
                  />
                </View>
              )}
            </View>

            {/* Playback controls */}
            {musicXmlContent && (
              <View style={styles.transport}>
                <Text style={[styles.transportLabel, { color: colors.textSecondary }]}>PLAYBACK</Text>
                <View style={[styles.controlsRow, { backgroundColor: colors.surface }]}>
                  <Pressable
                    onPress={() => {
                      void hapticFeedback.triggerMedium();
                      handleSynthPlayPause();
                    }}
                    accessibilityLabel={synthPlayer.isPlaying ? "Pause" : "Play"}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.playBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
                  >
                    <Ionicons name={synthPlayer.isPlaying ? "pause" : "play"} size={20} color={colors.buttonText} />
                  </Pressable>
                  <View style={styles.tempoControl}>
                    <Text style={[styles.tempoLabel, { color: colors.text }]}>
                      {(synthPlayer.tempo * 100).toFixed(0)}%
                    </Text>
                    <View style={styles.tempoButtons}>
                      <Pressable
                        onPress={() => {
                          void hapticFeedback.triggerLight();
                          synthPlayer.setTempo(Math.max(0.5, synthPlayer.tempo - 0.1));
                        }}
                        style={[styles.tempoBtn, { backgroundColor: colors.surface }]}
                        accessibilityLabel="Decrease tempo"
                        accessibilityRole="button"
                      >
                        <Ionicons name="remove" size={16} color={colors.text} />
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          void hapticFeedback.triggerLight();
                          synthPlayer.setTempo(Math.min(2.0, synthPlayer.tempo + 0.1));
                        }}
                        style={[styles.tempoBtn, { backgroundColor: colors.surface }]}
                        accessibilityLabel="Increase tempo"
                        accessibilityRole="button"
                      >
                        <Ionicons name="add" size={16} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            )}

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
                >
                  <Ionicons name="people-outline" size={18} color={colors.buttonText} />
                  <Text style={[styles.partsButtonText, { color: colors.buttonText }]}>
                    Select Parts ({visiblePartIds.size}/{partInfos.length})
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        ) : sheet.omrStatus === "processing" ? (
          <View style={styles.emptyState}>
            <Ionicons name="hourglass-outline" size={48} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {`Recognizing music… ${smoothProgress}%`}
            </Text>
            <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
              This score is still being processed. It updates here automatically — feel free to come back in a few minutes.
            </Text>
          </View>
        ) : sheet.omrStatus === "failed" ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Recognition failed</Text>
            <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
              This score could not be read. Delete it and import the PDF again.
            </Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No score loaded</Text>
            <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>The score could not be loaded. Try re-importing the PDF.</Text>
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <PartCheckSheet
        visible={partSheetVisible}
        parts={partInfos}
        partNoteCounts={partNoteCounts}
        visiblePartIds={visiblePartIds}
        onTogglePart={togglePartVisibility}
        onDismiss={() => setPartSheetVisible(false)}
      />

      <ScoreFullscreenModal
        visible={fullscreenVisible}
        musicXml={musicXmlContent ?? ""}
        positionMs={synthPlayer.positionMs * synthPlayer.tempo}
        visiblePartIndices={visiblePartIndices}
        isPlaying={synthPlayer.isPlaying}
        onPlayPause={handleSynthPlayPause}
        onClose={() => setFullscreenVisible(false)}
      />
    </>
  );
}

export const PracticeBrowseView = React.memo(PracticeBrowseViewComponent);

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: BorderRadius.sm, alignItems: "center", justifyContent: "center",
  },
  topBarTitle: { flex: 1, justifyContent: "center" },
  modeLabel: { ...Typography.label, fontSize: 11 },
  titleText: { ...Typography.h3, marginTop: Spacing.xs },
  subtitleText: { ...Typography.small },
  topBarRight: { flexDirection: "row", gap: Spacing.sm, alignItems: "center" },
  actionBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { paddingBottom: 100 },
  heroWrap: { marginHorizontal: Spacing.lg, marginVertical: Spacing.md },
  hero: { borderRadius: BorderRadius.md, overflow: "hidden", position: "relative" },
  errorStateWrap: { marginVertical: Spacing.lg },
  expandBtn: { position: "absolute", bottom: Spacing.md, right: Spacing.md, width: 40, height: 40, borderRadius: BorderRadius.sm, alignItems: "center", justifyContent: "center" },
  transport: { paddingHorizontal: Spacing.lg, marginVertical: Spacing.lg },
  transportLabel: { ...Typography.label, marginBottom: Spacing.md },
  controlsRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderRadius: BorderRadius.sm, flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  playBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  tempoControl: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.md },
  tempoLabel: { ...Typography.body, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
  tempoButtons: { flexDirection: "row", gap: Spacing.sm },
  tempoBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.md, paddingHorizontal: Spacing.xl },
  emptyTitle: { ...Typography.h3 },
  emptyMessage: { ...Typography.body, textAlign: "center" },
  partsSection: { paddingHorizontal: Spacing.lg, marginVertical: Spacing.lg },
  partsButton: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  partsButtonText: { ...Typography.body, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
});
