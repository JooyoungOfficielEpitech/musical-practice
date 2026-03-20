import React, { memo } from "react";
import { StyleSheet, View, Text, ScrollView } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import { useTheme } from "@/hooks/useTheme";
import { Typography, Spacing, BorderRadius } from "@/constants/theme";

interface SheetMusicViewerProps {
  imageUris: string[];
  width: number;
  height: number;
}

const SPRING = { damping: 15, stiffness: 150 };
const MIN_SCALE = 1;
const MAX_SCALE = 3;

export const SheetMusicViewer = memo(function SheetMusicViewer({
  imageUris,
  width,
  height,
}: SheetMusicViewerProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      const next = savedScale.value * e.scale;
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE, SPRING);
      }
    });

  const pan = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        translateX.value = withSpring(0, SPRING);
        translateY.value = withSpring(0, SPRING);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1, SPRING);
        translateX.value = withSpring(0, SPRING);
        translateY.value = withSpring(0, SPRING);
      } else {
        scale.value = withSpring(2, SPRING);
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan);
  const gesture = Gesture.Exclusive(doubleTap, composed);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (imageUris.length === 0) {
    return (
      <View style={[styles.empty, { width, height, backgroundColor: colors.backgroundSecondary }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No sheet music
        </Text>
      </View>
    );
  }

  // Page height: ~A4 ratio
  const pageHeight = Math.round((width - 8) * 1.4);

  return (
    <View style={[styles.container, { width, height }]}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={animatedStyle}>
          <ScrollView
            style={{ width, height }}
            contentContainerStyle={{ alignItems: "center" }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
            nestedScrollEnabled
          >
            {imageUris.map((uri, i) => (
              <Image
                key={`page-${i}`}
                source={{ uri }}
                accessibilityLabel={`Sheet music page ${i + 1} of ${imageUris.length}`}
                style={[
                  styles.pageImage,
                  {
                    width: width - 8,
                    height: pageHeight,
                    backgroundColor: colors.backgroundSecondary,
                  },
                ]}
                contentFit="contain"
              />
            ))}
          </ScrollView>
        </Animated.View>
      </GestureDetector>
      {imageUris.length > 1 && (
        <View style={[styles.pageIndicator, { backgroundColor: colors.overlay }]}>
          <Text style={[styles.pageText, { color: colors.overlayText }]}>
            {imageUris.length} pages
          </Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: BorderRadius.sm,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.sm,
  },
  emptyText: {
    ...Typography.body,
  },
  pageImage: {
    borderRadius: BorderRadius.xs,
    marginBottom: 4,
  },
  pageIndicator: {
    position: "absolute",
    bottom: Spacing.sm,
    right: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  pageText: {
    ...Typography.label,
  },
});
