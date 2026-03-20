import React, { memo, useState, useCallback } from "react";
import { StyleSheet, View, Text, FlatList, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface SheetMusicPagerProps {
  imageUris: string[];
}

const SPRING = { damping: 15, stiffness: 150 };

const ZoomableImage = memo(function ZoomableImage({
  uri,
  imageWidth,
  imageHeight,
  bgColor,
}: {
  uri: string;
  imageWidth: number;
  imageHeight: number;
  bgColor: string;
}) {
  const scale = useSharedValue(1);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withSpring(scale.value > 1 ? 1 : 2, SPRING);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={doubleTap}>
      <Animated.View style={animatedStyle} accessible accessibilityLabel="Double tap to zoom">
        <Image
          source={{ uri }}
          style={[
            styles.pageImage,
            { width: imageWidth, height: imageHeight, backgroundColor: bgColor },
          ]}
          contentFit="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
});

export const SheetMusicPager = memo(function SheetMusicPager({
  imageUris,
}: SheetMusicPagerProps) {
  const { colors } = useTheme();
  const { width, height: screenHeight } = useWindowDimensions();
  const [currentPage, setCurrentPage] = useState(0);

  const imageWidth = width - Spacing.xl * 2;
  const imageHeight = Math.round(screenHeight * 0.45);

  const onScroll = useCallback(
    (event: any) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const page = Math.round(offsetX / imageWidth);
      setCurrentPage(page);
    },
    [imageWidth],
  );

  if (imageUris.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.backgroundSecondary }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No images available
        </Text>
      </View>
    );
  }

  return (
    <View>
      <FlatList
        data={imageUris}
        horizontal
        snapToInterval={imageWidth}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, i) => `page-${i}`}
        renderItem={({ item }) => (
          <ZoomableImage
            uri={item}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            bgColor={colors.backgroundSecondary}
          />
        )}
      />
      {imageUris.length > 1 && (
        <View style={styles.dotsContainer}>
          {imageUris.map((_, i) => (
            <View
              key={i}
              testID="page-dot"
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === currentPage ? colors.primary : colors.borderLight,
                },
              ]}
            />
          ))}
        </View>
      )}
      <Text style={[styles.zoomHint, { color: colors.textSecondary }]}>
        Double tap to zoom
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  pageImage: {
    borderRadius: BorderRadius.md,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyContainer: {
    height: 200,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    ...Typography.body,
  },
  zoomHint: {
    ...Typography.label,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
});
