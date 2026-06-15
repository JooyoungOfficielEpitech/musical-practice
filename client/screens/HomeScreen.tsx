import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  FlatList,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useTheme } from "@/hooks/useTheme";
import { usePractice } from "@/context/PracticeContext";
import { SheetCard } from "@/components/SheetCard";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";
import type { RootStackParamList, TabParamList } from "@/types/navigation";

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

function formatMinutes(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { sheets, sessions, stats, loading, refreshData } = usePractice();
  const [focusedButton, setFocusedButton] = useState<string | null>(null);

  const recentSheets = sheets.slice(0, 5);
  const todaySessions = sessions.filter(
    (s) => new Date(s.startedAt).toDateString() === new Date().toDateString(),
  );
  const todayTime = todaySessions.reduce((acc, s) => acc + s.duration, 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.backgroundDefault }]}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.lg, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refreshData} tintColor={colors.primary} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.text }]}>Musical Practice</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {todaySessions.length > 0
              ? `${todaySessions.length}${todaySessions.length === 1 ? " session" : " sessions"} today`
              : "Ready to practice?"}
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate("Profile")}
          onFocus={() => setFocusedButton("profile")}
          onBlur={() => setFocusedButton(null)}
          accessibilityLabel="Go to profile"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.avatarBtn,
            {
              opacity: pressed ? 0.8 : 1,
              borderWidth: focusedButton === "profile" ? 2 : 0,
              borderColor: focusedButton === "profile" ? colors.primary : "transparent",
              borderRadius: 20,
            },
          ]}
        >
          <Ionicons name="person-circle" size={38} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <StatCard icon="time-outline" label="Today" value={todayTime > 0 ? formatMinutes(todayTime) : "0m"} color={colors.primary} />
        <StatCard icon="flame-outline" label="Streak" value={`${stats.streak}d`} color={colors.warning} />
        <StatCard icon="musical-notes-outline" label="Total" value={`${stats.totalSessions}`} color={colors.success} />
      </View>

      <View style={styles.quickStartSection}>
        <Pressable
          onPress={() => navigation.navigate("Practice")}
          onFocus={() => setFocusedButton("warmup")}
          onBlur={() => setFocusedButton(null)}
          accessibilityLabel="Start warm-up"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.quickStartBtn,
            {
              backgroundColor: colors.primaryDark,
              transform: [{ scale: pressed ? 0.98 : 1 }],
              borderWidth: focusedButton === "warmup" ? 2 : 0,
              borderColor: focusedButton === "warmup" ? colors.primary : "transparent",
            },
          ]}
        >
          <View style={[styles.quickStartIcon, { backgroundColor: colors.overlayLight }]}>
            <Ionicons name="play-circle" size={32} color={colors.buttonText} />
          </View>
          <View style={styles.quickStartText}>
            <Text style={[styles.quickStartTitle, { color: colors.buttonText }]}>Warm-up</Text>
            <Text style={[styles.quickStartSub, { color: colors.overlayText }]}>Practice pitch without a score</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.buttonText} />
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Scores</Text>
          {sheets.length > 0 && (
            <Pressable
              onPress={() => navigation.navigate("Library")}
              accessibilityRole="button"
              accessibilityLabel="See all scores"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </Pressable>
          )}
        </View>
        {recentSheets.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title="No scores yet"
            message="Upload your first score to start practicing"
            actionLabel="Go to Library"
            onAction={() => navigation.navigate("Library")}
          />
        ) : (
          <FlatList
            data={recentSheets}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            keyExtractor={(item) => item.id}
            scrollEnabled={recentSheets.length > 0}
            renderItem={({ item }) => (
              <SheetCard
                sheet={item}
                compact
                onPress={() => navigation.navigate("PracticeDetail", { sheetId: item.id })}
              />
            )}
          />
        )}
      </View>

      {todaySessions.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: Spacing.xl }]}>{"Today's Sessions"}</Text>
          {todaySessions.map((session) => (
            <View key={session.id} style={[styles.sessionItem, { backgroundColor: colors.surface }]}>
              <View style={[styles.sessionIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="musical-note" size={18} color={colors.primary} />
              </View>
              <View style={styles.sessionInfo}>
                <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
                  {session.sheetMusicTitle}
                </Text>
                <Text style={[styles.sessionMeta, { color: colors.textSecondary }]}>
                  {formatMinutes(session.duration)} · {session.bpm} BPM
                </Text>
              </View>
              <View style={[styles.sessionScore, { backgroundColor: colors.backgroundSecondary }]}>
                <Text
                  style={[
                    styles.scoreText,
                    {
                      color:
                        session.accuracy >= 80
                          ? colors.success
                          : session.accuracy >= 60
                            ? colors.warning
                            : colors.error,
                    },
                  ]}
                >
                  {session.accuracy}%
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  greeting: { ...Typography.h2 },
  subtitle: { ...Typography.body, marginTop: 2 },
  avatarBtn: { padding: 6 },
  statsRow: { flexDirection: "row", paddingHorizontal: Spacing.xl, gap: Spacing.sm + 2, marginBottom: Spacing.xl },
  quickStartSection: { paddingHorizontal: Spacing.xl, marginBottom: Spacing["2xl"] },
  quickStartBtn: { flexDirection: "row", alignItems: "center", borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.sm + 6 },
  quickStartIcon: {
    width: 48, height: 48, borderRadius: BorderRadius.sm,
    alignItems: "center", justifyContent: "center",
  },
  quickStartText: { flex: 1 },
  quickStartTitle: { ...Typography.subtitle },
  quickStartSub: { ...Typography.small, marginTop: 1 },
  section: { marginBottom: Spacing["2xl"] },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.xl, marginBottom: Spacing.sm + 6 },
  sectionTitle: { ...Typography.subtitle, fontSize: 18 },
  seeAll: { ...Typography.body },
  horizontalList: { paddingHorizontal: Spacing.xl, gap: Spacing.md },
  sessionItem: {
    flexDirection: "row", alignItems: "center", marginHorizontal: Spacing.xl,
    padding: Spacing.sm + 6, borderRadius: BorderRadius.sm, marginBottom: Spacing.sm, gap: Spacing.md,
  },
  sessionIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sessionInfo: { flex: 1 },
  sessionTitle: { ...Typography.body, fontFamily: "Nunito_500Medium", fontWeight: "500" },
  sessionMeta: { ...Typography.label, marginTop: 2 },
  sessionScore: { paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs, borderRadius: BorderRadius.xs },
  scoreText: { ...Typography.body, fontFamily: "Nunito_700Bold", fontWeight: "700" },
});
