import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  FlatList,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePractice } from "@/lib/practice-context";
import { SheetCard } from "@/components/SheetCard";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";

function formatMinutes(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { sheets, sessions, stats, loading, refreshData } = usePractice();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const recentSheets = sheets.slice(0, 5);
  const todaySessions = sessions.filter(
    (s) => new Date(s.startedAt).toDateString() === new Date().toDateString(),
  );
  const todayTime = todaySessions.reduce((acc, s) => acc + s.duration, 0);

  return (
    <ScrollView
      style={[styles.container]}
      contentContainerStyle={{ paddingTop: insets.top + webTopInset + 16, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refreshData} tintColor={Colors.light.primary} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Musical Practice</Text>
          <Text style={styles.subtitle}>
            {todaySessions.length > 0
              ? `${todaySessions.length}${todaySessions.length === 1 ? " session" : " sessions"} today`
              : "Ready to practice?"}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/(tabs)/profile")}
          style={({ pressed }) => [styles.avatarBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="person-circle" size={38} color={Colors.light.primary} />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <StatCard
          icon="time-outline"
          label="Today"
          value={todayTime > 0 ? formatMinutes(todayTime) : "0m"}
          color={Colors.light.primary}
        />
        <StatCard
          icon="flame-outline"
          label="Streak"
          value={`${stats.streak}d`}
          color={Colors.light.warning}
        />
        <StatCard
          icon="musical-notes-outline"
          label="Total"
          value={`${stats.totalSessions}`}
          color={Colors.light.success}
        />
      </View>

      <View style={styles.quickStartSection}>
        <Pressable
          onPress={() => router.push("/(tabs)/practice")}
          style={({ pressed }) => [
            styles.quickStartBtn,
            { transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <View style={styles.quickStartIcon}>
            <Ionicons name="play-circle" size={32} color={Colors.light.primaryText} />
          </View>
          <View style={styles.quickStartText}>
            <Text style={styles.quickStartTitle}>Quick Practice</Text>
            <Text style={styles.quickStartSub}>Start with metronome</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.light.primaryText} />
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Scores</Text>
          {sheets.length > 0 && (
            <Pressable onPress={() => router.push("/(tabs)/library")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          )}
        </View>
        {recentSheets.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title="No scores yet"
            message="Upload your first sheet music to start practicing"
            actionLabel="Add Score"
            onAction={() => router.push("/(tabs)/library")}
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
                onPress={() =>
                  router.push({
                    pathname: "/practice-detail",
                    params: { sheetId: item.id },
                  })
                }
              />
            )}
          />
        )}
      </View>

      {todaySessions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Sessions</Text>
          {todaySessions.map((session) => (
            <View key={session.id} style={styles.sessionItem}>
              <View style={styles.sessionIcon}>
                <Ionicons name="musical-note" size={18} color={Colors.light.primary} />
              </View>
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionTitle} numberOfLines={1}>
                  {session.sheetMusicTitle}
                </Text>
                <Text style={styles.sessionMeta}>
                  {formatMinutes(session.duration)} · {session.bpm} BPM
                </Text>
              </View>
              <View style={styles.sessionScore}>
                <Text
                  style={[
                    styles.scoreText,
                    {
                      color:
                        session.accuracy >= 80
                          ? Colors.light.success
                          : session.accuracy >= 60
                            ? Colors.light.warning
                            : Colors.light.error,
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
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  greeting: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  avatarBtn: {
    padding: 2,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  quickStartSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  quickStartBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.primaryDark,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  quickStartIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickStartText: {
    flex: 1,
  },
  quickStartTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primaryText,
  },
  quickStartSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    marginTop: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  seeAll: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.primary,
  },
  horizontalList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  sessionItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    padding: 14,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  sessionIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.light.primary + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
  },
  sessionMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  sessionScore: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  scoreText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});
