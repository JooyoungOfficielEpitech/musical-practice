import React, { useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { InteractiveScore } from "@/components/InteractiveScore";
import { PitchStrip } from "@/components/PitchStrip";
import { MetronomeBottomSheet } from "@/components/MetronomeBottomSheet";
import { AudioBottomSheet } from "@/components/AudioBottomSheet";
import { Spacing, BorderRadius, Typography, Fonts, ClayShadow } from "@/constants/theme";
import type { useSynthPlayer } from "@/hooks/useSynthPlayer";
import type { useNoteEditor } from "@/hooks/useNoteEditor";
import type { PitchResult } from "@/lib/audio/types";

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
}

export function PracticeActiveView({
  title, musicXml, synthPlayer, noteEditor,
  isListening, currentPitch, currentBpm, audioUrl, onGoBack,
}: PracticeActiveViewProps): React.JSX.Element {
  const { colors } = useTheme();
  const [metronomeVisible, setMetronomeVisible] = useState(false);
  const [audioVisible, setAudioVisible] = useState(false);

  const handlePlayPause = (): void => {
    if (synthPlayer.isPlaying) {
      synthPlayer.pause();
    } else {
      synthPlayer.play();
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
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

      {/* Score — fills available space */}
      <View style={styles.scoreArea}>
        <InteractiveScore
          musicXml={noteEditor.editedMusicXml || musicXml}
          positionMs={synthPlayer.positionMs * synthPlayer.tempo}
          onNotePress={noteEditor.selectNote}
        />
      </View>

      {/* Pitch strip — always visible */}
      <PitchStrip
        isListening={isListening}
        currentPitch={currentPitch}
      />

      {/* Bottom toolbar */}
      <View
        style={[styles.toolbar, { backgroundColor: colors.surface, borderTopColor: colors.borderLight }]}
        testID="practice-toolbar"
      >
        <Pressable
          onPress={handlePlayPause}
          accessibilityLabel={synthPlayer.isPlaying ? "Pause" : "Play"}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.toolbarBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons
            name={synthPlayer.isPlaying ? "pause" : "play"}
            size={22}
            color={colors.buttonText}
          />
        </Pressable>

        <Pressable
          onPress={() => setMetronomeVisible(true)}
          accessibilityLabel="Open metronome"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.toolbarBtn,
            { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="musical-note-outline" size={22} color={colors.text} />
        </Pressable>

        <Pressable
          onPress={() => setAudioVisible(true)}
          accessibilityLabel="Open audio player"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.toolbarBtn,
            { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="headset-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* Bottom sheets */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    borderRadius: 50,
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
  toolbar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.lg,
    ...ClayShadow,
  },
  toolbarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
