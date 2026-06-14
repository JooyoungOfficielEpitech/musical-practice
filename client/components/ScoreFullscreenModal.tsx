import React from "react";
import { StyleSheet, View, Modal, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { InteractiveScore } from "@/components/InteractiveScore";
import { Spacing } from "@/constants/theme";

export interface ScoreFullscreenModalProps {
  visible: boolean;
  onClose: () => void;
  musicXml: string;
  positionMs: number;
  visiblePartIndices?: number[];
  isPlaying: boolean;
  onPlayPause: () => void;
}

/** Full-screen score view — read the sheet music large, with a floating
 *  play/pause to listen while reading. Read-only (no note editing). */
export function ScoreFullscreenModal({
  visible, onClose, musicXml, positionMs, visiblePartIndices, isPlaying, onPlayPause,
}: ScoreFullscreenModalProps): React.JSX.Element | null {
  const { colors } = useTheme();
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundDefault }]} edges={["top", "bottom"]}>
        <View style={styles.scoreArea}>
          <InteractiveScore musicXml={musicXml} positionMs={positionMs} visiblePartIndices={visiblePartIndices} />
        </View>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close fullscreen"
          accessibilityRole="button"
          hitSlop={10}
          style={[styles.closeBtn, { backgroundColor: colors.surface }]}
        >
          <Ionicons name="contract" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={onPlayPause}
          accessibilityLabel={isPlaying ? "Pause" : "Play"}
          accessibilityRole="button"
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
  playBtn: {
    position: "absolute", bottom: Spacing.xl, right: Spacing.lg,
    width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", zIndex: 10,
  },
});
