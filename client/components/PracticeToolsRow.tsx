import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { hapticFeedback } from "@/lib/hapticFeedback";
import { LivePitchBadge } from "@/components/LivePitchBadge";
import { Spacing, BorderRadius, Typography, Fonts } from "@/constants/theme";
import type { PracticeExtrasState } from "@/hooks/usePracticeExtras";

export interface PracticeToolsRowProps {
  extras: PracticeExtrasState;
}

function formatTakeDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Sing-along (mic scoring) and fix-notes (edit mode) toggles + live feedback. */
export function PracticeToolsRow({ extras }: PracticeToolsRowProps): React.JSX.Element {
  const { colors } = useTheme();
  const { singAlong, editor } = extras;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <ToolButton
          icon="mic"
          label={singAlong.active ? "Stop singing" : "Sing along"}
          active={singAlong.active}
          onPress={() => {
            void hapticFeedback.triggerMedium();
            void singAlong.toggle();
          }}
          accessibilityLabel={singAlong.active ? "Stop sing along scoring" : "Start sing along scoring"}
        />
        <ToolButton
          icon="create-outline"
          label="Fix notes"
          active={editor.editMode}
          onPress={() => {
            void hapticFeedback.triggerLight();
            editor.toggleEditMode();
          }}
          accessibilityLabel={editor.editMode ? "Exit note editing" : "Fix wrong notes"}
        />
        {editor.hasEdits && (
          <Pressable
            onPress={() => {
              void hapticFeedback.triggerLight();
              editor.resetEdits();
            }}
            accessibilityLabel="Undo all note edits"
            accessibilityRole="button"
            style={styles.resetBtn}
          >
            <Ionicons name="arrow-undo-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.resetText, { color: colors.textSecondary }]}>Undo edits</Text>
          </Pressable>
        )}
      </View>

      {singAlong.active && (
        <LivePitchBadge pitch={singAlong.livePitch} accuracyPercent={singAlong.accuracyPercent} />
      )}
      {singAlong.active && !singAlong.livePitch && (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Listening… sing your part along with playback
        </Text>
      )}
      {!singAlong.active && singAlong.lastTake && (
        <Pressable
          onPress={() => {
            void hapticFeedback.triggerLight();
            void singAlong.toggleTakePlayback();
          }}
          accessibilityRole="button"
          accessibilityLabel={singAlong.takePlaying ? "Pause my last take" : "Play my last take"}
          style={({ pressed }) => [styles.takeRow, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]}
        >
          <Ionicons
            name={singAlong.takePlaying ? "pause-circle" : "play-circle"}
            size={22}
            color={colors.primary}
          />
          <Text style={[styles.takeText, { color: colors.text }]}>
            My last take · {formatTakeDuration(singAlong.lastTake.durationSec)}
          </Text>
        </Pressable>
      )}
      {singAlong.error && (
        <Text style={[styles.hint, { color: colors.error }]}>
          {singAlong.error.includes("permission")
            ? "Microphone access is needed for sing-along scoring — enable it in Settings."
            : "Microphone unavailable — sing-along scoring can't start."}
        </Text>
      )}
      {singAlong.multiPartWarning && (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Several parts are playing — solo your part for accurate scoring.
        </Text>
      )}
      {editor.editMode && (
        <Text style={[styles.hint, { color: colors.primary }]}>
          Tap a note on the score to fix it. Solo your part first if notes overlap.
        </Text>
      )}
    </View>
  );
}

interface ToolButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}

function ToolButton({ icon, label, active, onPress, accessibilityLabel }: ToolButtonProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.toolBtn,
        {
          backgroundColor: active ? colors.primary : colors.surface,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={16} color={active ? colors.buttonText : colors.text} />
      <Text style={[styles.toolText, { color: active ? colors.buttonText : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, flexWrap: "wrap" },
  toolBtn: {
    flexDirection: "row", alignItems: "center", gap: Spacing.xs,
    paddingHorizontal: Spacing.md, minHeight: 40, borderRadius: BorderRadius.sm,
  },
  toolText: { ...Typography.small, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
  resetBtn: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 40, paddingHorizontal: Spacing.sm },
  takeRow: {
    flexDirection: "row", alignItems: "center", gap: Spacing.sm,
    paddingHorizontal: Spacing.md, minHeight: 44, borderRadius: BorderRadius.sm,
    alignSelf: "flex-start",
  },
  takeText: { ...Typography.small, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
  resetText: { ...Typography.small },
  hint: { ...Typography.small, fontSize: 11 },
});
