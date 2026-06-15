import React, { useCallback } from "react";
import { StyleSheet, Text, View, Modal, Pressable, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ClayShadow, Fonts, Colors } from "@/constants/theme";
import type { PartInfo } from "@/types/music";

export interface PartSelectorBottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  parts: PartInfo[];
  visiblePartIds: Set<string>;
  onTogglePart: (partId: string) => void;
}

export function PartSelectorBottomSheet({
  visible,
  onDismiss,
  parts,
  visiblePartIds,
  onTogglePart,
}: PartSelectorBottomSheetProps): React.JSX.Element | null {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      accessibilityViewIsModal={true}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onDismiss}
        accessible={false}
        accessibilityLabel="Dismiss"
      />
      <SheetContent onDismiss={onDismiss}>
        {parts.length <= 1 ? (
          <SinglePartMessage />
        ) : (
          <PartList
            parts={parts}
            visiblePartIds={visiblePartIds}
            onTogglePart={onTogglePart}
          />
        )}
      </SheetContent>
    </Modal>
  );
}

function SinglePartMessage(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Text style={[styles.singlePartText, { color: colors.textSecondary }]}>
      Single part score
    </Text>
  );
}

interface SheetContentProps {
  onDismiss: () => void;
  children: React.ReactNode;
}

function SheetContent({ onDismiss, children }: SheetContentProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View
      testID="part-selector-bottom-sheet"
      style={[styles.sheet, { backgroundColor: colors.surface }]}
    >
      <View style={styles.header}>
        <View
          accessible={true}
          accessibilityLabel="Drag to dismiss"
          style={[styles.handle, { backgroundColor: colors.borderLight }]}
        />
        <Text style={[styles.title, { color: colors.text }]}>Parts</Text>
        <Pressable
          onPress={onDismiss}
          accessibilityLabel="Close parts selector"
          accessibilityRole="button"
          hitSlop={12}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        This song has multiple voice parts. Select which part(s) to show.
      </Text>
      {children}
    </View>
  );
}

interface PartRowProps {
  part: PartInfo;
  isVisible: boolean;
  onToggle: () => void;
}

function getVoiceDescription(name: string): string {
  const upper = name.toUpperCase();
  if (upper.includes("SOPRANO")) return "(Highest)";
  if (upper.includes("ALTO")) return "(High)";
  if (upper.includes("TENOR")) return "(Low)";
  if (upper.includes("BASS")) return "(Lowest)";
  return "";
}

const PartRow = React.memo(function PartRow({
  part,
  isVisible,
  onToggle,
}: PartRowProps): React.JSX.Element {
  const { colors } = useTheme();
  const voiceDesc = getVoiceDescription(part.name);
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityLabel={`${part.name} ${voiceDesc}`}
      accessibilityState={{ checked: isVisible }}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.borderLight, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.partCol}>
        <Text style={[styles.partName, { color: colors.text }]} numberOfLines={1}>
          {part.name}
        </Text>
        {voiceDesc && (
          <Text style={[styles.voiceDesc, { color: colors.textSecondary }]} numberOfLines={1}>
            {voiceDesc}
          </Text>
        )}
      </View>
      <Ionicons
        testID={`icon-${part.id}`}
        name={isVisible ? "checkmark-circle" : "ellipse-outline"}
        size={22}
        color={isVisible ? colors.primary : colors.textSecondary}
      />
    </Pressable>
  );
});

interface PartListProps {
  parts: PartInfo[];
  visiblePartIds: Set<string>;
  onTogglePart: (partId: string) => void;
}

function PartList({
  parts,
  visiblePartIds,
  onTogglePart,
}: PartListProps): React.JSX.Element {
  const renderItem = useCallback(
    ({ item }: { item: PartInfo }) => (
      <PartRow
        part={item}
        isVisible={visiblePartIds.has(item.id)}
        onToggle={() => onTogglePart(item.id)}
      />
    ),
    [visiblePartIds, onTogglePart],
  );

  return (
    <FlatList
      data={parts}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.light.ripple,
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingBottom: Spacing["2xl"],
    paddingHorizontal: Spacing.lg,
    ...ClayShadow,
  },
  header: {
    alignItems: "center",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts.bodySemiBold,
    marginBottom: Spacing.xs,
  },
  closeBtn: {
    position: "absolute",
    right: 0,
    top: Spacing.sm,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.body,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  list: {
    maxHeight: 320,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  partCol: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  partName: {
    fontSize: 15,
    fontFamily: Fonts.body,
    marginBottom: Spacing.xs,
  },
  voiceDesc: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  singlePartText: {
    fontSize: 14,
    fontFamily: Fonts.body,
    textAlign: "center",
    paddingVertical: Spacing.xl,
  },
});
