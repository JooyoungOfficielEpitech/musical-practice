import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { SheetMusicViewer } from "@/components/SheetMusicViewer";
import { FloatingPitchPanel } from "@/components/FloatingPitchPanel";
import { InteractiveScore } from "@/components/InteractiveScore";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { SheetMusic } from "@/lib/storage";
import type { AudioMode } from "@/hooks/usePracticeDetail";
import type { useSynthPlayer } from "@/hooks/useSynthPlayer";
import type { useNoteEditor } from "@/hooks/useNoteEditor";
import type { PitchResult } from "@/lib/audio/types";

export interface PracticeActiveViewProps {
  sheet: SheetMusic;
  audioMode: AudioMode;
  musicXmlContent: string | null;
  synthPlayer: ReturnType<typeof useSynthPlayer>;
  noteEditor: ReturnType<typeof useNoteEditor>;
  editMode: boolean;
  handleNotePress: (noteIndex: number) => void;
  isListening: boolean;
  currentPitch: PitchResult | null;
  pitchError: string | null;
  sessionAccuracy: number;
  isRecording: boolean;
  currentBpm: number;
  setCurrentBpm: (bpm: number) => void;
  topBarHeight: number;
  practiceContentHeight: number;
  screenWidth: number;
  onGoBack: () => void;
}

export function PracticeActiveView({
  sheet, audioMode, musicXmlContent,
  synthPlayer, noteEditor, editMode, handleNotePress,
  isListening, currentPitch, pitchError, sessionAccuracy, isRecording,
  currentBpm, setCurrentBpm, topBarHeight, practiceContentHeight, screenWidth, onGoBack,
}: PracticeActiveViewProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <>
      <View style={[styles.topBarOverlay, { height: topBarHeight }]}>
        <Pressable
          onPress={onGoBack}
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

      <View style={styles.practiceSheetArea}>
        {audioMode === "autoplay" && musicXmlContent ? (
          <InteractiveScore
            musicXml={noteEditor.editedMusicXml || musicXmlContent}
            currentNoteIndex={synthPlayer.currentNoteIndex}
            onNotePress={editMode ? noteEditor.selectNote : handleNotePress}
          />
        ) : (
          <SheetMusicViewer
            imageUris={sheet.imageUris}
            width={screenWidth}
            height={practiceContentHeight - topBarHeight - 48}
          />
        )}
      </View>

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
  );
}

const styles = StyleSheet.create({
  topBarOverlay: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm + 2,
    zIndex: 10,
  },
  backBtn: {
    width: 44, height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: { ...Typography.subtitle, fontSize: 18 },
  practiceSheetArea: { flex: 1 },
});
