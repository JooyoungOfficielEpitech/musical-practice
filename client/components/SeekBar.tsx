import React, { useMemo, useRef, useState, useCallback } from "react";
import { StyleSheet, View, PanResponder, type LayoutChangeEvent, type GestureResponderEvent } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { gestureXToMs, msToRatio } from "@/lib/audio/transportMath";
import type { LoopRange } from "@/hooks/useSynthPlayer";

/** Format milliseconds as MM:SS for accessibility announcements */
function formatTimeLabel(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export interface SeekBarProps {
  positionMs: number;
  durationMs: number;
  loopRange: LoopRange | null;
  onSeek: (ms: number) => void;
}

const THUMB = 16;
const TRACK_H = 8;

/** Draggable + tappable playback scrubber, with an optional A–B loop overlay. */
function SeekBarComponent({ positionMs, durationMs, loopRange, onSeek }: SeekBarProps): React.JSX.Element {
  const { colors } = useTheme();
  const widthRef = useRef(0);
  const [width, setWidth] = useState(0);
  // While dragging, follow the finger locally so the thumb feels immediate.
  const [scrubMs, setScrubMs] = useState<number | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  }, []);

  const seekFromX = useCallback(
    (x: number) => {
      const ms = gestureXToMs(x, widthRef.current, durationMs);
      setScrubMs(ms);
      onSeek(ms);
    },
    [durationMs, onSeek],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => seekFromX(e.nativeEvent.locationX),
        onPanResponderMove: (e: GestureResponderEvent) => seekFromX(e.nativeEvent.locationX),
        onPanResponderRelease: () => setScrubMs(null),
        onPanResponderTerminate: () => setScrubMs(null),
      }),
    [seekFromX],
  );

  const shownMs = scrubMs ?? positionMs;
  const progressRatio = msToRatio(shownMs, durationMs);
  const loopStartRatio = loopRange ? msToRatio(loopRange.startMs, durationMs) : 0;
  const loopEndRatio = loopRange ? msToRatio(loopRange.endMs, durationMs) : 0;

  return (
    <View
      onLayout={onLayout}
      hitSlop={{ top: 14, bottom: 14, left: 4, right: 4 }}
      accessibilityRole="adjustable"
      accessibilityLabel={`Seek to playback position, currently at ${formatTimeLabel(shownMs)} of ${formatTimeLabel(durationMs)}`}
      accessibilityHint="Drag to scrub through the track"
      accessibilityValue={{ now: Math.round(progressRatio * 100), min: 0, max: 100 }}
      accessibilityLiveRegion="assertive"
      style={styles.touch}
      {...responder.panHandlers}
    >
      <View style={[styles.track, { backgroundColor: colors.borderLight }]}>
        {loopRange && (
          <View
            style={[
              styles.loopRegion,
              { backgroundColor: colors.primarySubtle ?? colors.borderLight, left: `${loopStartRatio * 100}%`, width: `${Math.max(0, loopEndRatio - loopStartRatio) * 100}%` },
            ]}
          />
        )}
        <View style={[styles.progress, { backgroundColor: colors.primary, width: `${progressRatio * 100}%` }]} />
      </View>
      {loopRange && (
        <>
          <View style={[styles.loopMarker, { left: `${loopStartRatio * 100}%`, backgroundColor: colors.primary }]} />
          <View style={[styles.loopMarker, { left: `${loopEndRatio * 100}%`, backgroundColor: colors.primary }]} />
        </>
      )}
      {width > 0 && (
        <View
          style={[
            styles.thumb,
            { backgroundColor: colors.primary, borderColor: colors.surface, left: Math.max(0, Math.min(width - THUMB, progressRatio * width - THUMB / 2)) },
          ]}
        />
      )}
    </View>
  );
}

export const SeekBar = React.memo(SeekBarComponent);

const styles = StyleSheet.create({
  touch: { height: 32, justifyContent: "center" },
  track: { height: TRACK_H, borderRadius: TRACK_H / 2, overflow: "hidden" },
  loopRegion: { position: "absolute", top: 0, bottom: 0, opacity: 0.45 },
  progress: { height: "100%", borderRadius: TRACK_H / 2 },
  loopMarker: { position: "absolute", top: 4, width: 2, height: TRACK_H + 16, marginLeft: -1 },
  thumb: {
    position: "absolute", top: (32 - THUMB) / 2, width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 2,
  },
});
