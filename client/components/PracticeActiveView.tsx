import React, { useState, useMemo, useCallback } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { useLandscape } from "@/hooks/useLandscape";
import { PracticeToolbar } from "@/components/PracticeToolbar";
import { LoopControls } from "@/components/LoopControls";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { InteractiveScore } from "@/components/InteractiveScore";
import { PitchStrip } from "@/components/PitchStrip";
import { MetronomeBottomSheet } from "@/components/MetronomeBottomSheet";
import { AudioBottomSheet } from "@/components/AudioBottomSheet";
import { PartSelectorBottomSheet } from "@/components/PartSelectorBottomSheet";
import { makeLoopRange } from "@/lib/audio/transportMath";
import { Spacing, BorderRadius, Typography, Fonts } from "@/constants/theme";
import type { useSynthPlayer } from "@/hooks/useSynthPlayer";
import type { useNoteEditor } from "@/hooks/useNoteEditor";
import type { PitchResult } from "@/lib/audio/types";
import type { PartInfo } from "@/types/music";

export interface PracticeActiveViewProps {
  title: string;
  musicXml: string;
  synthPlayer: ReturnType<typeof useSynthPlayer>;
  noteEditor: ReturnType<typeof useNoteEditor>;
  isListening: boolean;
  currentPitch: PitchResult | null;
  currentBpm: number;
  audioUrl?: string;
  onGoBack: () => void;
  editMode: boolean;
  onToggleEditMode: () => void;
  parts: PartInfo[];
  visiblePartIds: Set<string>;
  onTogglePart: (partId: string) => void;
}

export function PracticeActiveView({
  title, musicXml, synthPlayer, noteEditor,
  isListening, currentPitch, currentBpm, audioUrl, onGoBack,
  editMode, onToggleEditMode, parts, visiblePartIds, onTogglePart,
}: PracticeActiveViewProps): React.JSX.Element {
  const { colors } = useTheme();
  const { isLandscape, toggleLandscape } = useLandscape();
  const [metronomeVisible, setMetronomeVisible] = useState(false);
  const [audioVisible, setAudioVisible] = useState(false);
  const [partSelectorVisible, setPartSelectorVisible] = useState(false);
  const [loopPointA, setLoopPointA] = useState<number | null>(null);
  const [loopPointB, setLoopPointB] = useState<number | null>(null);
  const [isLoopActive, setIsLoopActive] = useState(false);

  const visiblePartIndices = useMemo(
    () => parts.filter((p) => visiblePartIds.has(p.id)).map((p) => p.partIndex),
    [parts, visiblePartIds],
  );

  const handlePlayPause = (): void => {
    if (synthPlayer.isPlaying) {
      synthPlayer.pause();
    } else {
      synthPlayer.play();
    }
  };

  const handleCaptureLoopPointA = useCallback((ms: number) => {
    setLoopPointA(ms);
  }, []);

  const handleCaptureLoopPointB = useCallback(
    (ms: number) => {
      setLoopPointB(ms);
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

  // Close all modals before locking orientation to avoid iOS Fabric modal crash
  const handleEnterLandscape = useCallback(async () => {
    setMetronomeVisible(false);
    setAudioVisible(false);
    setPartSelectorVisible(false);
    await toggleLandscape();
  }, [toggleLandscape]);

  return (
    <View style={styles.container}>
      {/* Header — hidden in fullscreen */}
      {!isLandscape && (
        <>
          <View
            style={[styles.modeIndicator, { backgroundColor: colors.primary }]}
            accessible={true}
            accessibilityRole="header"
            accessibilityLabel="Now in practice mode"
          >
            <Text style={[styles.modeIndicatorText, { color: colors.buttonText }]}>
              PRACTICE — Tap Edit to adjust note pitches
            </Text>
          </View>
          <View style={styles.header}>
            <Pressable
              onPress={onGoBack}
              accessibilityLabel="Go back"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => [
                styles.backBtn,
                { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text
              style={[styles.titleText, { color: colors.text }]}
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>
        </>
      )}

      {/* Floating exit button — visible in fullscreen only */}
      {isLandscape && (
        <Pressable
          onPress={toggleLandscape}
          accessibilityLabel="Exit fullscreen"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.exitFullscreenBtn, { backgroundColor: colors.surface }]}
        >
          <Ionicons name="contract" size={20} color={colors.text} />
        </Pressable>
      )}

      {/* Score — fills available space */}
      <View style={styles.scoreArea}>
        <InteractiveScore
          musicXml={noteEditor.editedMusicXml || musicXml}
          positionMs={synthPlayer.positionMs * synthPlayer.tempo}
          onNotePress={noteEditor.selectNote}
          visiblePartIndices={visiblePartIndices}
        />
        {editMode && noteEditor.selectedIndex === null && (
          <Text
            style={[styles.editHint, { color: colors.primary }]}
            accessibilityLiveRegion="polite"
            accessible={true}
          >
            Tap a note to edit pitch
          </Text>
        )}
      </View>

      {/* Pitch strip — always visible */}
      <PitchStrip
        isListening={isListening}
        currentPitch={currentPitch}
      />

      {/* Landscape: minimal floating play/pause — no modals to avoid iOS orientation crash */}
      {isLandscape ? (
        <Pressable
          onPress={handlePlayPause}
          accessibilityLabel={synthPlayer.isPlaying ? "Pause" : "Play"}
          accessibilityRole="button"
          style={[styles.landscapePlayBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name={synthPlayer.isPlaying ? "pause" : "play"} size={22} color={colors.buttonText} />
        </Pressable>
      ) : (
        <>
          {/* Portrait toolbar */}
          <PracticeToolbar
            isPlaying={synthPlayer.isPlaying}
            editMode={editMode}
            parts={parts}
            onPlayPause={handlePlayPause}
            onMetronome={() => setMetronomeVisible(true)}
            onAudio={() => setAudioVisible(true)}
            onToggleEditMode={onToggleEditMode}
            onSelectParts={() => setPartSelectorVisible(true)}
            onToggleLandscape={handleEnterLandscape}
            currentTempo={synthPlayer.tempo}
            onTempoChange={synthPlayer.setTempo}
          />

          {/* Loop controls — accessible during active practice */}
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

          {/* Bottom sheets — only mounted in portrait to prevent Fabric modal orientation crash */}
          <MetronomeBottomSheet
            visible={metronomeVisible}
            onDismiss={() => setMetronomeVisible(false)}
            initialBpm={currentBpm}
          />
          <AudioBottomSheet
            visible={audioVisible}
            onDismiss={() => setAudioVisible(false)}
            audioUrl={audioUrl}
          />
          <PartSelectorBottomSheet
            visible={partSelectorVisible}
            onDismiss={() => setPartSelectorVisible(false)}
            parts={parts}
            visiblePartIds={visiblePartIds}
            onTogglePart={onTogglePart}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modeIndicator: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  modeIndicatorText: {
    ...Typography.small,
    fontFamily: Fonts.bodyBold,
    fontWeight: "600",
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm + 2,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    ...Typography.subtitle,
    fontFamily: Fonts.heading,
    fontSize: 18,
    flex: 1,
  },
  scoreArea: {
    flex: 1,
  },
  editHint: {
    position: "absolute",
    bottom: Spacing.sm,
    alignSelf: "center",
    fontSize: 14,
    fontFamily: Fonts.body,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  exitFullscreenBtn: {
    position: "absolute",
    top: 12,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  landscapePlayBtn: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
});
