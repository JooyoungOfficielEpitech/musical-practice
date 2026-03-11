import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { usePractice } from "@/lib/practice-context";
import { StatCard } from "@/components/StatCard";

function formatMinutes(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

function getWeeklyData(sessions: { startedAt: number; duration: number }[]) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const now = new Date();
  const weekData = days.map((day, i) => {
    const d = new Date(now);
    const currentDay = d.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    d.setDate(d.getDate() + mondayOffset + i);
    const dateStr = d.toDateString();
    const daySessions = sessions.filter(
      (s) => new Date(s.startedAt).toDateString() === dateStr,
    );
    const totalMins = Math.floor(
      daySessions.reduce((acc, s) => acc + s.duration, 0) / 60,
    );
    return { day, mins: totalMins, isToday: d.toDateString() === now.toDateString() };
  });
  return weekData;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { stats, sessions, sheets } = usePractice();
  const weeklyData = getWeeklyData(sessions);
  const maxMins = Math.max(...weeklyData.map((d) => d.mins), 1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + webTopInset + 16,
        paddingBottom: Platform.OS === "web" ? 34 : 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatarWrap}>
          <Ionicons name="person" size={32} color={Colors.light.primary} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>Practice User</Text>
          <Text style={styles.profileSub}>
            {sheets.length} score{sheets.length !== 1 ? "s" : ""} in library
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard
          icon="time-outline"
          label="Total Time"
          value={formatMinutes(stats.totalPracticeTime)}
          color={Colors.light.primary}
        />
        <StatCard
          icon="flame-outline"
          label="Streak"
          value={`${stats.streak}d`}
          color={Colors.light.warning}
        />
      </View>
      <View style={styles.statsRow}>
        <StatCard
          icon="analytics-outline"
          label="Avg Accuracy"
          value={`${stats.averageAccuracy}%`}
          color={Colors.light.success}
        />
        <StatCard
          icon="musical-notes-outline"
          label="Sessions"
          value={`${stats.totalSessions}`}
          color={Colors.light.secondary}
        />
      </View>

      <View style={styles.weekCard}>
        <Text style={styles.weekTitle}>This Week</Text>
        <View style={styles.chartRow}>
          {weeklyData.map((d) => (
            <View key={d.day} style={styles.chartCol}>
              <View style={styles.barWrap}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: d.mins > 0 ? Math.max((d.mins / maxMins) * 100, 8) : 4,
                      backgroundColor:
                        d.mins > 0
                          ? d.isToday
                            ? Colors.light.primary
                            : Colors.light.secondary
                          : Colors.light.surfaceSecondary,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.chartDay,
                  d.isToday && { color: Colors.light.primary, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {d.day}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.menuSection}>
        <Text style={styles.menuSectionTitle}>Settings</Text>
        {[
          { icon: "notifications-outline" as const, label: "Notifications" },
          { icon: "cloud-outline" as const, label: "Cloud Backup" },
          { icon: "shield-outline" as const, label: "Privacy" },
          { icon: "help-circle-outline" as const, label: "Help & Support" },
          { icon: "information-circle-outline" as const, label: "About" },
        ].map((item) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [
              styles.menuItem,
              { backgroundColor: pressed ? Colors.light.surfaceSecondary : Colors.light.surface },
            ]}
          >
            <View style={styles.menuIconWrap}>
              <Ionicons name={item.icon} size={20} color={Colors.light.textSecondary} />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.light.textTertiary} />
          </Pressable>
        ))}
      </View>

      <View style={styles.subscriptionCard}>
        <View style={styles.subHeader}>
          <Ionicons name="diamond-outline" size={22} color={Colors.light.primary} />
          <Text style={styles.subTitle}>Upgrade to Pro</Text>
        </View>
        <Text style={styles.subDesc}>
          Unlimited scores, cloud backup, and advanced analytics
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.subBtn,
            { transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <Text style={styles.subBtnText}>$9.99/month</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    padding: 18,
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    gap: 14,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.cardShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.primary + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  profileSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 10,
  },
  weekCard: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.cardShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  weekTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    marginBottom: 16,
  },
  chartRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 120,
  },
  chartCol: {
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  barWrap: {
    flex: 1,
    justifyContent: "flex-end",
    width: "100%",
    alignItems: "center",
  },
  bar: {
    width: 20,
    borderRadius: 6,
    minHeight: 4,
  },
  chartDay: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textTertiary,
  },
  menuSection: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  menuSectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 4,
    gap: 12,
  },
  menuIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
  },
  subscriptionCard: {
    marginHorizontal: 20,
    borderRadius: 18,
    padding: 20,
    backgroundColor: Colors.light.primary + "0D",
    borderWidth: 1,
    borderColor: Colors.light.primary + "25",
    marginBottom: 20,
    gap: 10,
  },
  subHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  subTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  subDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    lineHeight: 19,
  },
  subBtn: {
    backgroundColor: Colors.light.primaryDark,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  subBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primaryText,
  },
});
