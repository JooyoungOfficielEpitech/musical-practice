import React, { memo, useState, useEffect } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";

interface AudioPlayerProps {
  audioUri: string;
  /** When provided, AudioPlayer becomes controlled — parent manages playback */
  externalPlayer?: {
    isLoaded: boolean;
    isPlaying: boolean;
    positionMs: number;
    durationMs: number;
    error: string | null;
    play: () => Promise<void>;
    pause: () => Promise<void>;
    seekTo: (ms: number) => Promise<void>;
  };
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export const AudioPlayer = memo(function AudioPlayer({ audioUri, externalPlayer }: AudioPlayerProps) {
  const { colors } = useTheme();
  const [trackWidth, setTrackWidth] = useState(200);
  const internalPlayer = useAudioPlayer();
  const player = externalPlayer ?? internalPlayer;
  const {
    isLoaded,
    isPlaying,
    positionMs,
    durationMs,
    error,
    play,
    pause,
    seekTo,
  } = player;

  // Only manage lifecycle when using internal player
  useEffect(() => {
    if (externalPlayer) return;
    internalPlayer.loadSound(audioUri);
    return () => {
      internalPlayer.unload();
    };
  }, [audioUri, externalPlayer, internalPlayer.loadSound, internalPlayer.unload]);

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }, Shadows.sm]}>
        <Ionicons name="musical-notes-outline" size={16} color={colors.textSecondary} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>Audio unavailable</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }, Shadows.sm]}>
      <Pressable
        onPress={handlePlayPause}
        accessibilityLabel={isPlaying ? "Pause audio" : "Play audio"}
        accessibilityHint="Play or pause audio"
        accessibilityRole="button"
        android_ripple={{ color: colors.rippleLight }}
        style={({ pressed }) => [
          styles.playButton,
          { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={20}
          color={colors.buttonText}
        />
      </Pressable>

      <View style={styles.trackSection}>
        <Pressable
          onPress={(e) => {
            if (durationMs <= 0 || trackWidth <= 0) return;
            const { locationX } = e.nativeEvent;
            const seekRatio = Math.max(0, Math.min(1, locationX / trackWidth));
            seekTo(seekRatio * durationMs);
          }}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          accessibilityLabel="Seek audio position"
          accessibilityRole="adjustable"
          style={styles.trackTouchable}
        >
          <View style={[styles.trackBg, { backgroundColor: colors.borderLight }]}>
            <View
              style={[
                styles.trackProgress,
                { backgroundColor: colors.primary, width: `${progress * 100}%` },
              ]}
            />
          </View>
        </Pressable>
        <View style={styles.timeRow}>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            {formatTime(positionMs)}
          </Text>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            {formatTime(durationMs)}
          </Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  trackSection: {
    flex: 1,
    gap: Spacing.xs,
  },
  trackTouchable: {
    paddingVertical: 8,
  },
  trackBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  trackProgress: {
    height: "100%",
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    ...Typography.label,
    fontFamily: "Nunito_500Medium",
    fontWeight: "500",
  },
  errorText: {
    ...Typography.small,
    flex: 1,
  },
});
