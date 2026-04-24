import React from "react";
import { StyleSheet, Text, View, Modal, Pressable, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, ClayShadow, Fonts } from "@/constants/theme";
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
    >
      <Pressable style={styles.backdrop} onPress={onDismiss} />
      <SheetContent onDismiss={onDismiss}>
        {parts.length <= 1 ? (
          <SinglePartMessage />
        ) : (
          <FlatList
            data={parts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PartRow
                part={item}
                isVisible={visiblePartIds.has(item.id)}
                onToggle={() => onTogglePart(item.id)}
              />
            )}
            style={styles.list}
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
        <View style={[styles.handle, { backgroundColor: colors.borderLight }]} />
        <Text style={[styles.title, { color: colors.text }]}>Parts</Text>
        <Pressable
          onPress={onDismiss}
          accessibilityLabel="Close parts selector"
          accessibilityRole="button"
          hitSlop={8}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

interface PartRowProps {
  part: PartInfo;
  isVisible: boolean;
  onToggle: () => void;
}

function PartRow({ part, isVisible, onToggle }: PartRowProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isVisible }}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.borderLight, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[styles.partName, { color: colors.text }]} numberOfLines={1}>
        {part.name}
      </Text>
      <Ionicons
        testID={`icon-${part.id}`}
        name={isVisible ? "checkmark-circle" : "ellipse-outline"}
        size={22}
        color={isVisible ? colors.primary : colors.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
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
  partName: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.body,
    marginRight: Spacing.sm,
  },
  singlePartText: {
    fontSize: 14,
    fontFamily: Fonts.body,
    textAlign: "center",
    paddingVertical: Spacing.xl,
  },
});
