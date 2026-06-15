import React, { memo, useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, Fonts } from "@/constants/theme";

interface CentsIndicatorProps {
  cents: number;
  maxCents?: number;
  width?: number;
}

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

export const CentsIndicator = memo(function CentsIndicator({
  cents,
  maxCents = 50,
  width: propWidth,
}: CentsIndicatorProps) {
  const { colors } = useTheme();
  const position = useSharedValue(0);
  const trackWidth = propWidth ?? 220;
  const halfRange = (trackWidth - 20) / 2; // dot travel range

  useEffect(() => {
    const clampedCents = Math.max(-maxCents, Math.min(maxCents, cents));
    const normalized = clampedCents / maxCents; // -1 to 1
    position.value = withSpring(normalized, SPRING_CONFIG);
  }, [cents, maxCents, position]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * halfRange }],
  }));

  const centsAbs = Math.abs(cents);
  const dotColor =
    centsAbs <= 10 ? colors.success : centsAbs <= 25 ? colors.warning : colors.error;
  const tuningLabel =
    centsAbs <= 10 ? "On Pitch" : cents > 0 ? "Sharp" : "Flat";

  // Zone widths proportional to total width (ratios from original 220px)
  const zoneRed = Math.round(trackWidth * 0.1364);
  const zoneYellow = Math.round(trackWidth * 0.1818);
  const zoneGreen = Math.round(trackWidth * 0.3636);

  return (
    <View
      style={styles.container}
      accessibilityValue={{
        min: -maxCents,
        max: maxCents,
        now: Math.round(cents),
        text: `${tuningLabel}: ${cents > 0 ? "+" : ""}${Math.round(cents)} cents`,
      }}
    >
      <View style={[styles.labels, { width: trackWidth }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Flat</Text>
        <View style={styles.centerValueWrap}>
          <Text style={[styles.centsValue, { color: dotColor }]}>
            {cents > 0 ? "+" : ""}{Math.round(cents)}¢
          </Text>
          <Text style={[styles.tuningLabel, { color: dotColor }]}>
            {tuningLabel}
          </Text>
        </View>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Sharp</Text>
      </View>
      <View style={[styles.trackContainer, { width: trackWidth }]}>
        {/* Color zones */}
        <View style={[styles.zone, { left: 0, width: zoneRed, backgroundColor: colors.errorLight }]} />
        <View style={[styles.zone, { left: zoneRed, width: zoneYellow, backgroundColor: colors.warningLight }]} />
        <View style={[styles.zone, { left: zoneRed + zoneYellow, width: zoneGreen, backgroundColor: colors.successLight }]} />
        <View style={[styles.zone, { left: zoneRed + zoneYellow + zoneGreen, width: zoneYellow, backgroundColor: colors.warningLight }]} />
        <View style={[styles.zone, { left: zoneRed + zoneYellow * 2 + zoneGreen, width: zoneRed, backgroundColor: colors.errorLight }]} />

        {/* Track line */}
        <View style={[styles.track, { width: trackWidth - 20, backgroundColor: colors.borderLight }]} />

        {/* Center mark */}
        <View style={[styles.centerMark, { backgroundColor: colors.success }]} />

        {/* Moving dot */}
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: dotColor },
            dotStyle,
          ]}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: Spacing.sm },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: { ...Typography.label, fontFamily: Fonts.body },
  centerValueWrap: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  centsValue: { ...Typography.small, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
  tuningLabel: { ...Typography.label, fontFamily: Fonts.body },
  trackContainer: {
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  zone: { position: "absolute", height: 24, borderRadius: BorderRadius.xs },
  track: {
    height: 2,
    borderRadius: 1,
  },
  centerMark: {
    position: "absolute",
    width: 2,
    height: 12,
    borderRadius: 1,
  },
  dot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
  },
});
