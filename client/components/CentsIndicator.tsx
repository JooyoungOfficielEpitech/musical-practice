import React, { memo, useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface CentsIndicatorProps {
  cents: number;
  maxCents?: number;
}

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

export const CentsIndicator = memo(function CentsIndicator({
  cents,
  maxCents = 50,
}: CentsIndicatorProps) {
  const { colors } = useTheme();
  const position = useSharedValue(0);

  useEffect(() => {
    const clampedCents = Math.max(-maxCents, Math.min(maxCents, cents));
    const normalized = clampedCents / maxCents; // -1 to 1
    position.value = withSpring(normalized, SPRING_CONFIG);
  }, [cents, maxCents, position]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * 100 }], // ±100px range
  }));

  const centsAbs = Math.abs(cents);
  const dotColor =
    centsAbs <= 10 ? colors.success : centsAbs <= 25 ? colors.warning : colors.error;

  return (
    <View style={styles.container}>
      <View style={styles.labels}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Flat</Text>
        <Text style={[styles.centsValue, { color: dotColor }]}>
          {cents > 0 ? "+" : ""}{Math.round(cents)}¢
        </Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Sharp</Text>
      </View>
      <View style={styles.trackContainer}>
        {/* Color zones */}
        <View style={[styles.zone, styles.zoneRed, { backgroundColor: colors.error + "15" }]} />
        <View style={[styles.zone, styles.zoneYellow, { backgroundColor: colors.warning + "15" }]} />
        <View style={[styles.zone, styles.zoneGreen, { backgroundColor: colors.success + "20" }]} />
        <View style={[styles.zone, styles.zoneYellow2, { backgroundColor: colors.warning + "15" }]} />
        <View style={[styles.zone, styles.zoneRed2, { backgroundColor: colors.error + "15" }]} />

        {/* Track line */}
        <View style={[styles.track, { backgroundColor: colors.borderLight }]} />

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
    width: 220,
  },
  label: { ...Typography.label },
  centsValue: { ...Typography.small, fontFamily: "Nunito_600SemiBold", fontWeight: "600" },
  trackContainer: {
    width: 220,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  zone: { position: "absolute", height: 24, borderRadius: BorderRadius.xs },
  zoneRed: { left: 0, width: 30 },
  zoneYellow: { left: 30, width: 40 },
  zoneGreen: { left: 70, width: 80 },
  zoneYellow2: { left: 150, width: 40 },
  zoneRed2: { left: 190, width: 30 },
  track: {
    width: 200,
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
