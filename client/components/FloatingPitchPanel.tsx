import React, { memo, useState, useCallback } from "react";
import { StyleSheet, Text, View, Pressable, useWindowDimensions } from "react-native";
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
import { Spacing, BorderRadius, Typography, Fonts, ClayShadow } from "@/constants/theme";
import type { PitchResult } from "@/lib/audio/types";

interface FloatingPitchPanelProps {
  isListening: boolean;
  currentPitch: PitchResult | null;
  accuracy: number;
  pitchError?: string | null;
  isRecording: boolean;
}

const SPRING = { damping: 20, stiffness: 200 };
const COLLAPSED_HEIGHT = 44;
const EXPANDED_HEIGHT = 260;
const MARGIN = 12;

function getPanelWidth(screenWidth: number): number {
  if (screenWidth >= 768) return 280;
  if (screenWidth >= 430) return 200;
  if (screenWidth >= 393) return 180;
  return 160;
}

export const FloatingPitchPanel = memo(function FloatingPitchPanel({
  isListening,
  currentPitch,
  accuracy,
  pitchError,
  isRecording,
}: FloatingPitchPanelProps) {
  const { colors } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const panelWidth = getPanelWidth(screenWidth);

  const [isExpanded, setIsExpanded] = useState(true);

  // Free drag — starts bottom-right
  const translateX = useSharedValue(screenWidth - panelWidth - MARGIN);
  const translateY = useSharedValue(screenHeight - EXPANDED_HEIGHT - MARGIN - 60);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const panelHeight = useSharedValue(EXPANDED_HEIGHT);

  const clampPosition = useCallback(
    (x: number, y: number) => {
      const h = isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;
      translateX.value = withSpring(
        Math.max(MARGIN, Math.min(x, screenWidth - panelWidth - MARGIN)),
        SPRING,
      );
      translateY.value = withSpring(
        Math.max(MARGIN, Math.min(y, screenHeight - h - MARGIN)),
        SPRING,
      );
    },
    [screenWidth, screenHeight, panelWidth, isExpanded, translateX, translateY],
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
      runOnJS(clampPosition)(translateX.value, translateY.value);
    });

  const toggleExpanded = useCallback(() => {
    const next = !isExpanded;
    setIsExpanded(next);
    panelHeight.value = withSpring(next ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT, SPRING);
  }, [isExpanded, panelHeight]);

  const animatedContainer = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  const animatedHeight = useAnimatedStyle(() => ({
    height: panelHeight.value,
  }));

  const staffWidth = panelWidth - Spacing.sm * 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <GestureDetector gesture={drag}>
        <Animated.View
          style={[styles.panel, animatedContainer, ClayShadow, { width: panelWidth, backgroundColor: colors.surface, borderColor: colors.borderLight }]}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Pitch panel"
        >
          <View pointerEvents="auto">
            <Animated.View style={[styles.body, animatedHeight]}>
              {isExpanded ? (
                <View style={styles.expandedInner}>
                  <Pressable onPress={toggleExpanded} style={styles.header} accessibilityLabel="Collapse pitch panel">
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Pitch</Text>
                    <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
                  </Pressable>
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
                </View>
              ) : (
                <Pressable onPress={toggleExpanded} accessibilityLabel="Expand pitch panel" style={styles.collapsedPill}>
                  {currentPitch ? (
                    <>
                      <Text style={[styles.pillNote, { color: colors.text }]}>
                        {currentPitch.note}{currentPitch.octave}
                      </Text>
                      <View style={[styles.pillDot, {
                        backgroundColor: Math.abs(currentPitch.cents) <= 10
                          ? colors.success
                          : Math.abs(currentPitch.cents) <= 25
                            ? colors.warning
                            : colors.error,
                      }]} />
                    </>
                  ) : (
                    <Text style={[styles.pillNote, { color: colors.textSecondary }]}>--</Text>
                  )}
                  <Ionicons name="chevron-up" size={14} color={colors.textSecondary} />
                </Pressable>
              )}
            </Animated.View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const TuningLabel = memo(function TuningLabel({ cents }: { cents: number }) {
  const { colors } = useTheme();
  const abs = Math.abs(cents);
  const color = abs <= 10 ? colors.success : abs <= 25 ? colors.warning : colors.error;
  const label = abs <= 10 ? "In Tune" : cents > 0 ? "Sharp" : "Flat";
  return <Text style={[styles.tuningText, { color }]}>{label}</Text>;
});

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    zIndex: 100,
    borderRadius: 50,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  body: { overflow: "hidden" },
  collapsedPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    minHeight: COLLAPSED_HEIGHT,
    paddingHorizontal: Spacing.sm,
  },
  pillNote: { fontSize: 14, fontFamily: Fonts.heading, fontWeight: "400" },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  expandedInner: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  headerTitle: { ...Typography.label, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
  pitchContent: { alignItems: "center", gap: Spacing.xs, paddingHorizontal: Spacing.xs },
  noteLabel: { fontSize: 16, fontFamily: Fonts.heading, fontWeight: "400" },
  tuningText: { ...Typography.label, fontFamily: Fonts.bodySemiBold, fontWeight: "600", textAlign: "center" },
  recBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  recDot: { width: 6, height: 6, borderRadius: 3 },
  recText: { ...Typography.label, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
});
