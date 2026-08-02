import React, { useMemo, useRef, useState, useCallback } from "react";
import {
  StyleSheet, View, PanResponder,
  type LayoutChangeEvent, type GestureResponderEvent, type AccessibilityActionEvent,
} from "react-native";
import { useTheme } from "@/hooks/useTheme";

export interface VolumeSliderProps {
  /** Volume 0..1. */
  value: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
}

const TRACK_H = 6;
const THUMB = 14;
const A11Y_STEP = 0.1;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * JS-only volume slider (no native dependency — safe to ship over OTA).
 * Drags preview locally and commit on release, because every committed change
 * rebuilds the scheduled note list.
 */
function VolumeSliderComponent({ value, onChange, accessibilityLabel }: VolumeSliderProps): React.JSX.Element {
  const { colors } = useTheme();
  const widthRef = useRef(0);
  const [, setWidth] = useState(0);
  const [scrubValue, setScrubValue] = useState<number | null>(null);
  const scrubRef = useRef<number | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const v = clamp01(widthRef.current > 0 ? e.nativeEvent.locationX / widthRef.current : 0);
          scrubRef.current = v;
          setScrubValue(v);
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          const v = clamp01(widthRef.current > 0 ? e.nativeEvent.locationX / widthRef.current : 0);
          scrubRef.current = v;
          setScrubValue(v);
        },
        onPanResponderRelease: () => {
          if (scrubRef.current !== null) onChange(scrubRef.current);
          scrubRef.current = null;
          setScrubValue(null);
        },
        onPanResponderTerminate: () => {
          scrubRef.current = null;
          setScrubValue(null);
        },
      }),
    [onChange],
  );

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const action = event.nativeEvent.actionName;
      if (action === "increment") onChange(clamp01(Math.round((value + A11Y_STEP) * 10) / 10));
      if (action === "decrement") onChange(clamp01(Math.round((value - A11Y_STEP) * 10) / 10));
    },
    [value, onChange],
  );

  const shown = clamp01(scrubValue ?? value);

  return (
    <View
      onLayout={onLayout}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ now: Math.round(shown * 100), min: 0, max: 100 }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={handleAccessibilityAction}
      hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}
      style={styles.touch}
      {...responder.panHandlers}
    >
      <View style={[styles.track, { backgroundColor: colors.borderLight }]}>
        <View style={[styles.fill, { backgroundColor: colors.primary, width: `${shown * 100}%` }]} />
      </View>
      <View
        style={[
          styles.thumb,
          { backgroundColor: colors.primary, borderColor: colors.surface, left: `${shown * 100}%` },
        ]}
      />
    </View>
  );
}

export const VolumeSlider = React.memo(VolumeSliderComponent);

const styles = StyleSheet.create({
  touch: { height: 28, justifyContent: "center", flex: 1 },
  track: { height: TRACK_H, borderRadius: TRACK_H / 2, overflow: "hidden" },
  fill: { height: "100%", borderRadius: TRACK_H / 2 },
  thumb: {
    position: "absolute", top: (28 - THUMB) / 2, width: THUMB, height: THUMB,
    borderRadius: THUMB / 2, borderWidth: 2, marginLeft: -THUMB / 2,
  },
});
