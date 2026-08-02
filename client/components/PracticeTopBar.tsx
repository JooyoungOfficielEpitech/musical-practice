import React, { useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

export interface PracticeTopBarProps {
  title: string;
  artist?: string;
  onGoBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** Top bar of the practice screen: back, title block, edit/delete actions. */
function PracticeTopBarComponent({
  title, artist, onGoBack, onEdit, onDelete,
}: PracticeTopBarProps): React.JSX.Element {
  const { colors } = useTheme();
  const [editBtnFocused, setEditBtnFocused] = useState(false);
  const [deleteBtnFocused, setDeleteBtnFocused] = useState(false);

  return (
    <View style={styles.topBar}>
      <Pressable onPress={onGoBack} accessibilityLabel="Go back to library" accessibilityRole="button" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <View style={styles.topBarTitle}>
        <Text style={[styles.modeLabel, { color: colors.textSecondary }]}>SCORE + LISTEN</Text>
        <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        {!!artist && <Text style={[styles.subtitleText, { color: colors.textSecondary }]} numberOfLines={1}>{artist}</Text>}
      </View>
      <View style={styles.topBarRight}>
        <Pressable
          onPress={onEdit}
          onFocus={() => setEditBtnFocused(true)}
          onBlur={() => setEditBtnFocused(false)}
          accessibilityLabel="Edit score"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1, borderWidth: editBtnFocused ? 2 : 0, borderColor: editBtnFocused ? colors.primary : "transparent" }]}
        >
          <Ionicons name="create-outline" size={22} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={onDelete}
          onFocus={() => setDeleteBtnFocused(true)}
          onBlur={() => setDeleteBtnFocused(false)}
          accessibilityLabel="Delete score"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1, borderWidth: deleteBtnFocused ? 2 : 0, borderColor: deleteBtnFocused ? colors.primary : "transparent" }]}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </Pressable>
      </View>
    </View>
  );
}

export const PracticeTopBar = React.memo(PracticeTopBarComponent);

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: BorderRadius.sm, alignItems: "center", justifyContent: "center",
  },
  topBarTitle: { flex: 1, justifyContent: "center" },
  modeLabel: { ...Typography.label, fontSize: 11 },
  titleText: { ...Typography.h3, marginTop: Spacing.xs },
  subtitleText: { ...Typography.small },
  topBarRight: { flexDirection: "row", gap: Spacing.sm, alignItems: "center" },
  actionBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
