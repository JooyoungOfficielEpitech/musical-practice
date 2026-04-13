import React, { memo, useState, useCallback } from "react";
import { StyleSheet, Text, View, Pressable, Platform, useWindowDimensions } from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { MusicalStaff } from "@/components/MusicalStaff";
import { CentsIndicator } from "@/components/CentsIndicator";
import { Metronome } from "@/components/Metronome";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";
import type { PitchResult } from "@/lib/audio/types";

type Corner = "tl" | "tr" | "bl" | "br";
type Tab = "pitch" | "metronome";

interface FloatingPitchPanelProps {
  isListening: boolean;
  currentPitch: PitchResult | null;
  accuracy: number;
  pitchError?: string | null;
  isRecording: boolean;
  currentBpm: number;
  onBpmChange: (bpm: number) => void;
}

const SPRING = { damping: 20, stiffness: 200 };
const MARGIN = 12;
const COLLAPSED_HEIGHT = 44;
const EXPANDED_HEIGHT = 280;

function getPanelWidth(screenWidth: number): number {
  if (screenWidth >= 768) return 280;
  if (screenWidth >= 430) return 200;
  if (screenWidth >= 393) return 180;
  return 160;
}

function getCornerPosition(
  corner: Corner,
  screenWidth: number,
  screenHeight: number,
  panelWidth: number,
  topBarHeight: number,
  bottomBarHeight: number,
) {
  const top = corner.startsWith("t") ? topBarHeight + MARGIN : screenHeight - bottomBarHeight - EXPANDED_HEIGHT - MARGIN;
  const left = corner.endsWith("l") ? MARGIN : screenWidth - panelWidth - MARGIN;
  return { top, left };
}

export const FloatingPitchPanel = memo(function FloatingPitchPanel({
  isListening,
  currentPitch,
  accuracy,
  pitchError,
  isRecording,
  currentBpm,
  onBpmChange,
}: FloatingPitchPanelProps) {
  const { colors, isDark } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const panelWidth = getPanelWidth(screenWidth);
  const topBarHeight = 56;
  const bottomBarHeight = 60;

  const [activeTab, setActiveTab] = useState<Tab>("pitch");
  const [isExpanded, setIsExpanded] = useState(true);
  const [corner, setCorner] = useState<Corner>("br");

  const pos = getCornerPosition(corner, screenWidth, screenHeight, panelWidth, topBarHeight, bottomBarHeight);
  const translateX = useSharedValue(pos.left);
  const translateY = useSharedValue(pos.top);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const panelHeight = useSharedValue(EXPANDED_HEIGHT);

  const snapToCorner = useCallback(
    (c: Corner) => {
      const p = getCornerPosition(c, screenWidth, screenHeight, panelWidth, topBarHeight, bottomBarHeight);
      translateX.value = withSpring(p.left, SPRING);
      translateY.value = withSpring(p.top, SPRING);
      setCorner(c);
    },
    [screenWidth, screenHeight, panelWidth, translateX, translateY, topBarHeight, bottomBarHeight],
  );

  const handleDragEnd = useCallback(
    (x: number, y: number) => {
      const midX = screenWidth / 2;
      const midY = screenHeight / 2;
      const isLeft = x + panelWidth / 2 < midX;
      const isTop = y + (isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT) / 2 < midY;
      let nearest: Corner = "br";
      if (isTop && isLeft) nearest = "tl";
      else if (isTop && !isLeft) nearest = "tr";
      else if (!isTop && isLeft) nearest = "bl";
      snapToCorner(nearest);
    },
    [screenWidth, screenHeight, panelWidth, isExpanded, snapToCorner],
  );

  const drag = Gesture.Pan()
    .onStart(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedX.value + e.translationX;
      translateY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      runOnJS(handleDragEnd)(translateX.value, translateY.value);
    });

  const toggleExpanded = useCallback(() => {
    const next = !isExpanded;
    setIsExpanded(next);
    panelHeight.value = withSpring(next ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT, SPRING);
  }, [isExpanded, panelHeight]);

  const animatedContainer = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const animatedHeight = useAnimatedStyle(() => ({
    height: panelHeight.value,
  }));

  const staffWidth = panelWidth - Spacing.sm * 2;

  const collapsedContent = (
    <Pressable onPress={toggleExpanded} accessibilityLabel="Expand pitch panel" accessibilityRole="button" style={styles.collapsedPill}>
      {currentPitch ? (
        <>
          <Text style={[styles.pillNote, { color: colors.text }]}>
            {currentPitch.note}{currentPitch.octave}
          </Text>
          <View
            style={[
              styles.pillDot,
              {
                backgroundColor:
                  Math.abs(currentPitch.cents) <= 10
                    ? colors.success
                    : Math.abs(currentPitch.cents) <= 25
                      ? colors.warning
                      : colors.error,
              },
            ]}
          />
        </>
      ) : (
        <Text style={[styles.pillNote, { color: colors.textSecondary }]}>--</Text>
      )}
      <Ionicons name="chevron-up" size={14} color={colors.textSecondary} />
    </Pressable>
  );

  const expandedContent = (
    <View style={styles.expandedInner}>
      {/* Tab bar */}
      <Pressable onPress={toggleExpanded} style={styles.header}>
        <View style={styles.tabRow}>
          <Pressable
            onPress={() => setActiveTab("pitch")}
            accessibilityLabel="Pitch tab"
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "pitch" }}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={[
              styles.tab,
              activeTab === "pitch" && { backgroundColor: colors.primaryLight },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === "pitch" ? colors.primary : colors.textSecondary },
              ]}
            >
              Pitch
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("metronome")}
            accessibilityLabel="Metronome tab"
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "metronome" }}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={[
              styles.tab,
              activeTab === "metronome" && { backgroundColor: colors.primaryLight },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === "metronome" ? colors.primary : colors.textSecondary },
              ]}
            >
              Met
            </Text>
          </Pressable>
        </View>
        <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
      </Pressable>

      {/* Tab content */}
      <View style={styles.tabContent}>
        {activeTab === "pitch" ? (
          <View style={styles.pitchContent}>
            {isListening && currentPitch && (
              <Text style={[styles.noteLabel, { color: colors.text }]}>
                {currentPitch.note}{currentPitch.octave}
              </Text>
            )}
            <MusicalStaff
              isListening={isListening}
              currentPitch={currentPitch}
              accuracy={accuracy}
              error={pitchError}
              width={staffWidth}
              height={60}
              compact
            />
            {isListening && currentPitch && (
              <CentsIndicator cents={currentPitch.cents} width={staffWidth} />
            )}
            {isListening && currentPitch && (
              <TuningLabel cents={currentPitch.cents} />
            )}
            {isRecording && (
              <View style={[styles.recBadge, { backgroundColor: colors.errorLight }]}>
                <View style={[styles.recDot, { backgroundColor: colors.error }]} />
                <Text style={[styles.recText, { color: colors.error }]}>REC</Text>
              </View>
            )}
          </View>
        ) : (
          <Metronome initialBpm={currentBpm} onBpmChange={onBpmChange} compact />
        )}
      </View>
    </View>
  );

  const panelInner = (
    <Animated.View style={[styles.panelBody, animatedHeight, { width: panelWidth }]}>
      {isExpanded ? expandedContent : collapsedContent}
    </Animated.View>
  );

  const blurBackground =
    Platform.OS === "ios" ? (
      <BlurView
        intensity={60}
        tint={isDark ? "dark" : "light"}
        style={[styles.blur, { width: panelWidth, borderRadius: BorderRadius.sm }]}
      >
        {panelInner}
      </BlurView>
    ) : (
      <View
        style={[
          styles.blur,
          {
            width: panelWidth,
            borderRadius: BorderRadius.sm,
            backgroundColor: colors.overlay,
          },
        ]}
      >
        {panelInner}
      </View>
    );

  const handleAccessibilityAction = useCallback(
    (event: { nativeEvent: { actionName: string } }) => {
      const corners: Corner[] = ["tl", "tr", "bl", "br"];
      const idx = corners.indexOf(corner);
      if (event.nativeEvent.actionName === "increment") {
        snapToCorner(corners[(idx + 1) % corners.length]);
      } else if (event.nativeEvent.actionName === "decrement") {
        snapToCorner(corners[(idx - 1 + corners.length) % corners.length]);
      }
    },
    [corner, snapToCorner],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <GestureDetector gesture={drag}>
        <Animated.View
          style={[styles.panelOuter, animatedContainer, Shadows.lg]}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Pitch panel. Swipe up or down to move to different corner"
          accessibilityActions={[
            { name: "increment", label: "Move to next corner" },
            { name: "decrement", label: "Move to previous corner" },
          ]}
          onAccessibilityAction={handleAccessibilityAction}
        >
          <View pointerEvents="auto">{blurBackground}</View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const TuningLabel = memo(function TuningLabel({ cents }: { cents: number }) {
  const { colors } = useTheme();
  const centsAbs = Math.abs(cents);
  const color = centsAbs <= 10 ? colors.success : centsAbs <= 25 ? colors.warning : colors.error;
  const label = centsAbs <= 10 ? "In Tune" : cents > 0 ? "Sharp" : "Flat";
  return <Text style={[styles.tuningText, { color }]}>{label}</Text>;
});

const styles = StyleSheet.create({
  panelOuter: {
    position: "absolute",
    zIndex: 100,
  },
  blur: {
    overflow: "hidden",
  },
  panelBody: {
    overflow: "hidden",
  },

  // Collapsed
  collapsedPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    minHeight: COLLAPSED_HEIGHT,
    paddingHorizontal: Spacing.sm,
  },
  pillNote: {
    fontSize: 14,
    fontFamily: "Nunito_700Bold",
    fontWeight: "700",
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Expanded
  expandedInner: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  tabRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  tab: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
    minHeight: 36,
    minWidth: 44,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  tabText: {
    ...Typography.label,
    fontFamily: "Nunito_600SemiBold",
    fontWeight: "600",
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: Spacing.xs,
  },
  pitchContent: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  noteLabel: {
    fontSize: 16,
    fontFamily: "Nunito_700Bold",
    fontWeight: "700",
  },
  tuningText: {
    ...Typography.label,
    fontFamily: "Nunito_600SemiBold",
    fontWeight: "600",
    textAlign: "center",
  },
  recBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  recText: {
    ...Typography.label,
    fontFamily: "Nunito_600SemiBold",
    fontWeight: "600",
  },
});
