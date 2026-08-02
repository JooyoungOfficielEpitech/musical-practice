import React, { useCallback } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { VolumeSlider } from "@/components/VolumeSlider";
import { Spacing, BorderRadius, Fonts, Typography, ClayShadowSmall } from "@/constants/theme";
import type { PartInfo } from "@/types/music";

export interface PartCheckCardProps {
  parts: PartInfo[];
  visiblePartIds: Set<string>;
  partNoteCounts: Record<string, number>;
  onTogglePart: (partId: string) => void;
  /** Per-part volume 0..1; sliders render only when onVolumeChange is given. */
  partVolumes?: Record<string, number>;
  onVolumeChange?: (partId: string, volume: number) => void;
}

/**
 * Pre-practice "성부 체크" card: surfaces the voices/parts OMR detected so the
 * user can confirm them and pick which to practice before starting. Reuses the
 * same visiblePartIds the practice session and score preview read from, so the
 * choice flows straight through.
 */
function PartCheckCardComponent({
  parts,
  visiblePartIds,
  partNoteCounts,
  onTogglePart,
  partVolumes,
  onVolumeChange,
}: PartCheckCardProps): React.JSX.Element | null {
  const { colors } = useTheme();
  if (parts.length === 0) return null;

  const isMulti = parts.length > 1;
  const visibleCount = visiblePartIds.size;

  return (
    <View style={styles.section}>
      <View style={styles.label}>
        <Ionicons name="people-outline" size={14} color={colors.primary} />
        <Text style={[styles.labelText, { color: colors.primary }]}>
          {isMulti ? `Parts detected (${parts.length})` : "Part detected"}
        </Text>
      </View>
      {isMulti && (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Pick which part(s) to practice.
        </Text>
      )}
      <View style={[styles.card, { backgroundColor: colors.surface }, ClayShadowSmall]}>
        {parts.map((part, idx) => (
          <PartRow
            key={part.id}
            part={part}
            count={partNoteCounts[part.id] ?? 0}
            isVisible={visiblePartIds.has(part.id)}
            isLastVisible={visiblePartIds.has(part.id) && visibleCount <= 1}
            selectable={isMulti}
            isLastRow={idx === parts.length - 1}
            onTogglePart={onTogglePart}
            volume={partVolumes?.[part.id] ?? 1}
            onVolumeChange={onVolumeChange}
          />
        ))}
      </View>
    </View>
  );
}

interface PartRowProps {
  part: PartInfo;
  count: number;
  isVisible: boolean;
  isLastVisible: boolean;
  selectable: boolean;
  isLastRow: boolean;
  onTogglePart: (partId: string) => void;
  volume: number;
  onVolumeChange?: (partId: string, volume: number) => void;
}

const PartRow = React.memo(function PartRow({
  part,
  count,
  isVisible,
  isLastVisible,
  selectable,
  isLastRow,
  onTogglePart,
  volume,
  onVolumeChange,
}: PartRowProps): React.JSX.Element {
  const { colors } = useTheme();

  const handleVolumeChange = useCallback(
    (v: number) => onVolumeChange?.(part.id, v),
    [onVolumeChange, part.id],
  );

  const volumeRow = onVolumeChange && isVisible ? (
    <View style={styles.volumeRow}>
      <Ionicons name="volume-medium-outline" size={16} color={colors.textSecondary} />
      <VolumeSlider
        value={volume}
        onChange={handleVolumeChange}
        accessibilityLabel={`${part.name} volume`}
      />
    </View>
  ) : null;

  const handlePress = useCallback(() => {
    // Keep at least one part selected — ignore a tap that would clear the last.
    if (isLastVisible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    onTogglePart(part.id);
  }, [isLastVisible, onTogglePart, part.id]);

  const borderStyle = isLastRow
    ? undefined
    : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight };

  const content = (
    <>
      <View style={styles.rowText}>
        <Text style={[styles.partName, { color: colors.text }]} numberOfLines={1}>
          {part.name}
        </Text>
        <Text style={[styles.partCount, { color: colors.textSecondary }]}>{count} notes</Text>
      </View>
      {selectable && (
        <Ionicons
          testID={`partcheck-icon-${part.id}`}
          name={isVisible ? "checkmark-circle" : "ellipse-outline"}
          size={22}
          color={isVisible ? colors.primary : colors.textSecondary}
        />
      )}
    </>
  );

  if (!selectable) {
    return (
      <View style={borderStyle}>
        <View style={styles.row}>{content}</View>
        {volumeRow}
      </View>
    );
  }

  return (
    <View style={borderStyle}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="checkbox"
        accessibilityLabel={part.name}
        accessibilityHint={isLastVisible ? "At least one part must be selected" : undefined}
        accessibilityState={{ checked: isVisible, disabled: isLastVisible }}
        style={({ pressed }) => [styles.row, { opacity: isLastVisible ? 0.6 : (pressed ? 0.7 : 1) }]}
      >
        {content}
      </Pressable>
      {volumeRow}
    </View>
  );
});

export const PartCheckCard = React.memo(PartCheckCardComponent);

const styles = StyleSheet.create({
  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.sm },
  label: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.xs },
  labelText: {
    ...Typography.label,
    fontFamily: Fonts.heading,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hint: { ...Typography.small, marginBottom: Spacing.sm },
  card: { borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    minHeight: 44,
  },
  rowText: { flex: 1, marginRight: Spacing.sm },
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
    paddingRight: Spacing.xs,
  },
  partName: { fontSize: 15, fontFamily: Fonts.bodySemiBold },
  partCount: { ...Typography.small },
});
