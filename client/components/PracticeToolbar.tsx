import React, { useCallback, useState } from "react";
import { StyleSheet, View, Pressable, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ClayShadow } from "@/constants/theme";
import type { PartInfo } from "@/types/music";

export interface PracticeToolbarProps {
  isPlaying: boolean;
  editMode: boolean;
  parts: PartInfo[];
  onPlayPause: () => void;
  onMetronome: () => void;
  onAudio: () => void;
  onToggleEditMode: () => void;
  onSelectParts: () => void;
  onToggleLandscape: () => void;
  currentTempo?: number;
  onTempoChange?: (tempo: number) => void;
}

export function PracticeToolbar({
  isPlaying,
  editMode,
  parts,
  onPlayPause,
  onMetronome,
  onAudio,
  onToggleEditMode,
  onSelectParts,
  onToggleLandscape,
  currentTempo = 1.0,
  onTempoChange,
}: PracticeToolbarProps): React.JSX.Element {
  const { colors } = useTheme();
  const [focusedButton, setFocusedButton] = useState<string | null>(null);

  const handleTempoDecrease = useCallback(() => {
    if (onTempoChange) {
      const newTempo = Math.max(0.25, currentTempo - 0.25);
      onTempoChange(newTempo);
    }
  }, [currentTempo, onTempoChange]);

  const handleTempoIncrease = useCallback(() => {
    if (onTempoChange) {
      const newTempo = Math.min(2.0, currentTempo + 0.25);
      onTempoChange(newTempo);
    }
  }, [currentTempo, onTempoChange]);

  const handlePlayPause = useCallback(() => {
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onPlayPause();
  }, [onPlayPause]);

  const handleMetronome = useCallback(() => {
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onMetronome();
  }, [onMetronome]);

  const handleAudio = useCallback(() => {
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onAudio();
  }, [onAudio]);

  const handleToggleEditMode = useCallback(() => {
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onToggleEditMode();
  }, [onToggleEditMode]);

  const handleSelectParts = useCallback(() => {
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onSelectParts();
  }, [onSelectParts]);

  const handleToggleLandscape = useCallback(() => {
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onToggleLandscape();
  }, [onToggleLandscape]);

  return (
    <View
      testID="practice-toolbar"
      style={[styles.toolbar, { backgroundColor: colors.surface, borderTopColor: colors.borderLight }]}
    >
      {/* Left group */}
      <View style={styles.group}>
        <ToolbarButton
          id="metronome"
          icon="musical-notes"
          onPress={handleMetronome}
          color={colors.text}
          accessibilityLabel="Open metronome"
          isFocused={focusedButton === "metronome"}
          onFocus={() => setFocusedButton("metronome")}
          onBlur={() => setFocusedButton(null)}
        />
        {onTempoChange && (
          <>
            <ToolbarButton
              id="tempo-down"
              icon="remove-outline"
              onPress={handleTempoDecrease}
              color={colors.text}
              accessibilityLabel={`Slow down. Current tempo: ${currentTempo.toFixed(2)}x`}
              isFocused={focusedButton === "tempo-down"}
              onFocus={() => setFocusedButton("tempo-down")}
              onBlur={() => setFocusedButton(null)}
            />
            <ToolbarButton
              id="tempo-up"
              icon="add-outline"
              onPress={handleTempoIncrease}
              color={colors.text}
              accessibilityLabel={`Speed up. Current tempo: ${currentTempo.toFixed(2)}x`}
              isFocused={focusedButton === "tempo-up"}
              onFocus={() => setFocusedButton("tempo-up")}
              onBlur={() => setFocusedButton(null)}
            />
          </>
        )}
        <ToolbarButton
          id="audio"
          icon="volume-medium"
          onPress={handleAudio}
          color={colors.text}
          accessibilityLabel="Open audio player"
          isFocused={focusedButton === "audio"}
          onFocus={() => setFocusedButton("audio")}
          onBlur={() => setFocusedButton(null)}
        />
        {parts.length > 1 && (
          <ToolbarButton
            id="parts"
            icon="layers"
            onPress={handleSelectParts}
            color={colors.text}
            accessibilityLabel="Select parts"
            isFocused={focusedButton === "parts"}
            onFocus={() => setFocusedButton("parts")}
            onBlur={() => setFocusedButton(null)}
          />
        )}
      </View>

      {/* Center — large play/pause */}
      <Pressable
        onPress={handlePlayPause}
        onFocus={() => setFocusedButton("play")}
        onBlur={() => setFocusedButton(null)}
        accessibilityLabel={isPlaying ? "Pause" : "Play"}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.playBtn,
          {
            backgroundColor: colors.primaryDark,
            opacity: pressed ? 0.85 : 1,
            borderWidth: focusedButton === "play" ? 2 : 0,
            borderColor: focusedButton === "play" ? colors.buttonText : "transparent",
          },
        ]}
      >
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={26}
          color={colors.buttonText}
        />
      </Pressable>

      {/* Right group */}
      <View style={styles.group}>
        <ToolbarButton
          id="edit"
          icon={editMode ? "pencil" : "pencil-outline"}
          onPress={handleToggleEditMode}
          color={editMode ? colors.primary : colors.text}
          accessibilityLabel="Edit notes"
          isFocused={focusedButton === "edit"}
          onFocus={() => setFocusedButton("edit")}
          onBlur={() => setFocusedButton(null)}
        />
        <ToolbarButton
          id="fullscreen"
          icon="expand"
          onPress={handleToggleLandscape}
          color={colors.text}
          accessibilityLabel="Fullscreen"
          isFocused={focusedButton === "fullscreen"}
          onFocus={() => setFocusedButton("fullscreen")}
          onBlur={() => setFocusedButton(null)}
        />
      </View>
    </View>
  );
}

interface ToolbarButtonProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  color: string;
  accessibilityLabel: string;
  id: string;
  isFocused?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

const ToolbarButton = React.memo(function ToolbarButton({
  icon, onPress, color, accessibilityLabel, id, isFocused, onFocus, onBlur
}: ToolbarButtonProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={12}
      style={({ pressed }) => [
        styles.iconBtn,
        {
          opacity: pressed ? 0.6 : 1,
          borderWidth: isFocused ? 2 : 0,
          borderColor: isFocused ? color : "transparent",
          borderRadius: BorderRadius.sm,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={color} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    ...ClayShadow,
  },
  group: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
