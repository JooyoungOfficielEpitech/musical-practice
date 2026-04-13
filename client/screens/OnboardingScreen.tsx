import React, { useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  useWindowDimensions,
  type ViewToken,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { setOnboardingComplete } from "@/lib/onboarding";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface OnboardingPage {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

const PAGES: OnboardingPage[] = [
  {
    icon: "mic-outline",
    title: "Real-time Pitch Monitor",
    description: "See your vocal pitch accuracy in real-time as you sing. Know exactly when you're sharp, flat, or on pitch.",
  },
  {
    icon: "analytics-outline",
    title: "Track Your Progress",
    description: "Build daily practice streaks, track your accuracy over time, and watch your vocal skills improve week by week.",
  },
  {
    icon: "musical-notes-outline",
    title: "Your Practice Companion",
    description: "Store sheet music, use the metronome, record sessions, and review your performance. Everything you need in one app.",
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [currentPage, setCurrentPage] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleComplete = useCallback(async () => {
    await setOnboardingComplete();
    onComplete();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (currentPage < PAGES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentPage + 1, animated: true });
    } else {
      handleComplete();
    }
  }, [currentPage, handleComplete]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentPage(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const isLastPage = currentPage === PAGES.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDefault, paddingTop: insets.top }]}>
      <View style={styles.skipRow}>
        {!isLastPage && (
          <Pressable
            onPress={handleComplete}
            accessibilityLabel="Skip onboarding"
            accessibilityRole="button"
            hitSlop={12}
          >
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={PAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={[styles.page, { width }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name={item.icon} size={48} color={colors.primary} />
            </View>
            <Text style={[styles.pageTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.pageDesc, { color: colors.textSecondary }]}>{item.description}</Text>
          </View>
        )}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.dots}>
          {PAGES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === currentPage ? colors.primary : colors.borderLight },
              ]}
            />
          ))}
        </View>

        <Pressable
          onPress={handleNext}
          accessibilityLabel={isLastPage ? "Get started" : "Next page"}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.nextBtn,
            { backgroundColor: colors.primaryDark, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={[styles.nextBtnText, { color: colors.buttonText }]}>
            {isLastPage ? "Get Started" : "Next"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipRow: {
    alignItems: "flex-end",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    minHeight: 44,
  },
  skipText: {
    ...Typography.body,
    fontFamily: "Nunito_600SemiBold",
    fontWeight: "600",
  },
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["3xl"],
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["2xl"],
  },
  pageTitle: {
    ...Typography.h2,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  pageDesc: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: Spacing.lg,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nextBtn: {
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    minHeight: 52,
  },
  nextBtnText: {
    ...Typography.subtitle,
  },
});
