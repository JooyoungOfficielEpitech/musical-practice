import React, { useEffect } from "react";
import { StyleSheet, View, Modal, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { hapticFeedback } from "@/lib/hapticFeedback";
import { useLandscape } from "@/hooks/useLandscape";
import { InteractiveScore } from "@/components/InteractiveScore";
import { Spacing } from "@/constants/theme";

export interface ScoreFullscreenModalProps {
  visible: boolean;
  onClose: () => void;
  musicXml: string;
  positionMs: number;
  tempoBpm?: number;
  visiblePartIndices?: number[];
  isPlaying: boolean;
  onPlayPause: () => void;
  /** Tap-to-seek, same as the inline score. */
  onNotePress?: (noteIndex: number, timeMs: number | null) => void;
}

/** Full-screen score view — read the sheet music large, with a floating
 *  play/pause to listen while reading. Read-only (no note editing). */
export function ScoreFullscreenModal({
  visible, onClose, musicXml, positionMs, tempoBpm, visiblePartIndices, isPlaying, onPlayPause, onNotePress,
}: ScoreFullscreenModalProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const { isLandscape, toggleLandscape } = useLandscape();

  // Closing while rotated must hand the portrait-locked app back upright —
  // this component instance stays mounted, so the hook's unmount cleanup
  // never fires on a simple close.
  useEffect(() => {
    if (!visible && isLandscape) {
      toggleLandscape().catch(() => {});
    }
  }, [visible, isLandscape, toggleLandscape]);

  // Unmount when closed: this hosts its own OSMD WebView, and fullscreen is an
  // occasional action — keeping a second WebView alive idle costs more than the
  // reload on open.
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundDefault }]} edges={["top", "bottom"]}>
        <View style={styles.scoreArea}>
          <InteractiveScore
            musicXml={musicXml}
            positionMs={positionMs}
            tempoBpm={tempoBpm}
            visiblePartIndices={visiblePartIndices}
            onNotePress={onNotePress}
          />
        </View>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close fullscreen"
          accessibilityRole="button"
          android_ripple={{ color: colors.ripple, borderless: true }}
          hitSlop={10}
          style={[styles.closeBtn, { backgroundColor: colors.surface }]}
        >
          <Ionicons name="contract" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => { toggleLandscape().catch(() => {}); }}
          accessibilityLabel={isLandscape ? "Rotate to portrait" : "Rotate to landscape"}
          accessibilityRole="button"
          android_ripple={{ color: colors.ripple, borderless: true }}
          hitSlop={10}
          style={[styles.rotateBtn, { backgroundColor: colors.surface }]}
        >
          <Ionicons
            name={isLandscape ? "phone-portrait-outline" : "phone-landscape-outline"}
            size={20}
            color={colors.text}
          />
        </Pressable>
        <Pressable
          onPress={() => {
            void hapticFeedback.triggerMedium();
            onPlayPause();
          }}
          accessibilityLabel={isPlaying ? "Pause" : "Play"}
          accessibilityRole="button"
          android_ripple={{ color: colors.rippleLight, borderless: true }}
          style={[styles.playBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name={isPlaying ? "pause" : "play"} size={24} color={colors.buttonText} />
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scoreArea: { flex: 1 },
  closeBtn: {
    position: "absolute", top: Spacing.lg, right: Spacing.lg,
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", zIndex: 10,
  },
  rotateBtn: {
    position: "absolute", top: Spacing.lg, left: Spacing.lg,
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", zIndex: 10,
  },
  playBtn: {
    position: "absolute", bottom: Spacing.xl, right: Spacing.lg,
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", zIndex: 10,
  },
});
