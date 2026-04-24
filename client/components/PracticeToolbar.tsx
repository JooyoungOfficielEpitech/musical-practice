import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
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
}: PracticeToolbarProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View
      testID="practice-toolbar"
      style={[styles.toolbar, { backgroundColor: colors.surface, borderTopColor: colors.borderLight }]}
    >
      {/* Left group */}
      <View style={styles.group}>
        <ToolbarButton
          icon="musical-notes"
          onPress={onMetronome}
          color={colors.text}
          accessibilityLabel="Open metronome"
        />
        <ToolbarButton
          icon="volume-medium"
          onPress={onAudio}
          color={colors.text}
          accessibilityLabel="Open audio player"
        />
        {parts.length > 1 && (
          <ToolbarButton
            icon="layers"
            onPress={onSelectParts}
            color={colors.text}
            accessibilityLabel="Select parts"
          />
        )}
      </View>

      {/* Center — large play/pause */}
      <Pressable
        onPress={onPlayPause}
        accessibilityLabel={isPlaying ? "Pause" : "Play"}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.playBtn,
          { backgroundColor: colors.primaryDark, opacity: pressed ? 0.85 : 1 },
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
          icon={editMode ? "pencil" : "pencil-outline"}
          onPress={onToggleEditMode}
          color={editMode ? colors.primary : colors.text}
          accessibilityLabel="Edit notes"
        />
        <ToolbarButton
          icon="expand"
          onPress={onToggleLandscape}
          color={colors.text}
          accessibilityLabel="Fullscreen"
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
}

function ToolbarButton({ icon, onPress, color, accessibilityLabel }: ToolbarButtonProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={6}
      style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={22} color={color} />
    </Pressable>
  );
}

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
