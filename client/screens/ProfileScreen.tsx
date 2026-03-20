import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { usePractice } from "@/context/PracticeContext";
import { StatCard } from "@/components/StatCard";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";

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
  return days.map((day, i) => {
    const d = new Date(now);
    const currentDay = d.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    d.setDate(d.getDate() + mondayOffset + i);
    const dateStr = d.toDateString();
    const daySessions = sessions.filter((s) => new Date(s.startedAt).toDateString() === dateStr);
    const totalMins = Math.floor(daySessions.reduce((acc, s) => acc + s.duration, 0) / 60);
    return { day, mins: totalMins, isToday: d.toDateString() === now.toDateString() };
  });
}

const USERNAME_KEY = "@musicalpractice/username";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { stats, sessions, sheets, clearAllData } = usePractice();
  const weeklyData = getWeeklyData(sessions);
  const maxMins = Math.max(...weeklyData.map((d) => d.mins), 1);
  const [username, setUsername] = useState("Practice User");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    AsyncStorage.getItem(USERNAME_KEY).then((name) => {
      if (name) setUsername(name);
    });
  }, []);

  const handleSaveName = useCallback(async () => {
    const trimmed = editName.trim();
    if (trimmed) {
      setUsername(trimmed);
      await AsyncStorage.setItem(USERNAME_KEY, trimmed);
    }
    setIsEditingName(false);
  }, [editName]);

  const handleMenuPress = useCallback((label: string) => {
    Alert.alert(label, "This feature is coming soon.");
  }, []);

  const handleResetData = useCallback(() => {
    Alert.alert(
      "Reset All Data",
      "This will delete all scores, sessions, and statistics. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await clearAllData();
            Alert.alert("Done", "All data has been reset.");
          },
        },
      ],
    );
  }, [clearAllData]);

  const handleUpgrade = useCallback(() => {
    Alert.alert("Upgrade to Pro", "In-app purchases are coming soon. Stay tuned!");
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.backgroundDefault }]}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.lg, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
      </View>

      <View style={[styles.profileCard, { backgroundColor: colors.surface }, Shadows.md]}>
        <View style={[styles.avatarWrap, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="person" size={32} color={colors.primary} />
        </View>
        <View style={styles.profileInfo}>
          {isEditingName ? (
            <View style={styles.editNameRow}>
              <TextInput
                style={[styles.editNameInput, { color: colors.text, borderColor: colors.borderLight }]}
                value={editName}
                onChangeText={setEditName}
                autoFocus
                onSubmitEditing={handleSaveName}
                returnKeyType="done"
                placeholder="Enter your name"
                placeholderTextColor={colors.textSecondary}
              />
              <Pressable onPress={handleSaveName} hitSlop={8} accessibilityLabel="Save name" accessibilityRole="button">
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => { setEditName(username); setIsEditingName(true); }}
              style={styles.nameRow}
              accessibilityLabel="Edit your name"
              accessibilityRole="button"
            >
              <Text style={[styles.profileName, { color: colors.text }]}>{username}</Text>
              <Ionicons name="pencil-outline" size={14} color={colors.textSecondary} />
            </Pressable>
          )}
          <Text style={[styles.profileSub, { color: colors.textSecondary }]}>
            {sheets.length} score{sheets.length !== 1 ? "s" : ""} in library
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard icon="time-outline" label="Total Time" value={formatMinutes(stats.totalPracticeTime)} color={colors.primary} />
        <StatCard icon="flame-outline" label="Streak" value={`${stats.streak}d`} color={colors.warning} />
      </View>
      <View style={styles.statsRow}>
        <StatCard icon="analytics-outline" label="Avg Accuracy" value={`${stats.averageAccuracy}%`} color={colors.success} />
        <StatCard icon="musical-notes-outline" label="Sessions" value={`${stats.totalSessions}`} color={colors.secondary} />
      </View>

      <View style={[styles.weekCard, { backgroundColor: colors.surface }, Shadows.md]}>
        <Text style={[styles.weekTitle, { color: colors.text }]}>This Week</Text>
        <View style={styles.chartRow}>
          {weeklyData.map((d) => (
            <View key={d.day} style={styles.chartCol} accessible accessibilityLabel={`${d.day}: ${d.mins} minute${d.mins !== 1 ? "s" : ""} practiced`}>
              <View style={styles.barWrap}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: d.mins > 0 ? Math.max((d.mins / maxMins) * 100, 8) : 4,
                      backgroundColor:
                        d.mins > 0
                          ? d.isToday
                            ? colors.primary
                            : colors.secondary
                          : colors.backgroundSecondary,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.chartDay,
                  { color: colors.textSecondary },
                  d.isToday && { color: colors.primary, fontFamily: "Nunito_600SemiBold" },
                ]}
              >
                {d.day}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.menuSection}>
        <Text style={[styles.menuSectionTitle, { color: colors.textSecondary }]}>Settings</Text>
        {[
          { icon: "notifications-outline" as const, label: "Notifications" },
          { icon: "cloud-outline" as const, label: "Cloud Backup" },
          { icon: "shield-outline" as const, label: "Privacy" },
          { icon: "help-circle-outline" as const, label: "Help & Support" },
          { icon: "information-circle-outline" as const, label: "About" },
        ].map((item) => (
          <Pressable
            key={item.label}
            onPress={() => handleMenuPress(item.label)}
            accessibilityLabel={item.label}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.menuItem,
              { backgroundColor: pressed ? colors.backgroundSecondary : colors.surface },
            ]}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: colors.backgroundSecondary }]}>
              <Ionicons name={item.icon} size={20} color={colors.textSecondary} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        ))}
        <Pressable
          onPress={handleResetData}
          accessibilityLabel="Reset all data"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.menuItem,
            { backgroundColor: pressed ? colors.backgroundSecondary : colors.surface },
          ]}
        >
          <View style={[styles.menuIconWrap, { backgroundColor: colors.errorLight }]}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </View>
          <Text style={[styles.menuLabel, { color: colors.error }]}>Reset All Data</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={[styles.subscriptionCard, { backgroundColor: colors.primaryLight, borderColor: colors.primarySubtle }]}>
        <View style={styles.subHeader}>
          <Ionicons name="diamond-outline" size={22} color={colors.primary} />
          <Text style={[styles.subTitle, { color: colors.text }]}>Upgrade to Pro</Text>
        </View>
        <Text style={[styles.subDesc, { color: colors.textSecondary }]}>
          Unlimited scores, cloud backup, and advanced analytics
        </Text>
        <Pressable
          onPress={handleUpgrade}
          accessibilityLabel="Upgrade to Pro for $9.99 per month"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.subBtn,
            { backgroundColor: colors.primaryDark, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <Text style={[styles.subBtnText, { color: colors.buttonText }]}>$9.99/month</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  title: { ...Typography.h2 },
  profileCard: { flexDirection: "row", alignItems: "center", marginHorizontal: Spacing.xl, padding: Spacing.md + 6, borderRadius: BorderRadius.lg, gap: Spacing.sm + 6, marginBottom: Spacing.xl },
  avatarWrap: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  profileInfo: { flex: 1 },
  profileName: { ...Typography.subtitle, fontSize: 18 },
  profileSub: { ...Typography.small, marginTop: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  editNameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  editNameInput: { flex: 1, ...Typography.subtitle, fontSize: 18, borderBottomWidth: 1, paddingVertical: 2 },
  statsRow: { flexDirection: "row", paddingHorizontal: Spacing.xl, gap: Spacing.sm + 2, marginBottom: Spacing.sm + 2 },
  weekCard: { marginHorizontal: Spacing.xl, marginTop: Spacing.sm + 2, borderRadius: BorderRadius.lg, padding: Spacing.md + 6, marginBottom: Spacing["2xl"] },
  weekTitle: { ...Typography.subtitle, marginBottom: Spacing.lg },
  chartRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 120 },
  chartCol: { alignItems: "center", flex: 1, gap: Spacing.sm },
  barWrap: { flex: 1, justifyContent: "flex-end", width: "100%", alignItems: "center" },
  bar: { width: 20, borderRadius: 6, minHeight: 4 },
  chartDay: { ...Typography.label },
  menuSection: { marginHorizontal: Spacing.xl, marginBottom: Spacing["2xl"] },
  menuSectionTitle: { ...Typography.body, fontFamily: "Nunito_600SemiBold", fontWeight: "600", fontSize: 14, marginBottom: Spacing.sm + 2, textTransform: "uppercase", letterSpacing: 0.5 },
  menuItem: { flexDirection: "row", alignItems: "center", padding: Spacing.sm + 6, borderRadius: BorderRadius.sm, marginBottom: Spacing.xs, gap: Spacing.md },
  menuIconWrap: { width: 32, height: 32, borderRadius: BorderRadius.xs, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, ...Typography.body, fontFamily: "Nunito_500Medium", fontWeight: "500" },
  subscriptionCard: { marginHorizontal: Spacing.xl, borderRadius: BorderRadius.md, padding: Spacing.xl, borderWidth: 1, marginBottom: Spacing.xl, gap: Spacing.sm + 2 },
  subHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm + 2 },
  subTitle: { ...Typography.subtitle, fontSize: 17 },
  subDesc: { ...Typography.small, lineHeight: 19 },
  subBtn: { borderRadius: BorderRadius.sm, paddingVertical: Spacing.sm + 6, alignItems: "center", marginTop: Spacing.xs },
  subBtnText: { ...Typography.body, fontFamily: "Nunito_600SemiBold", fontWeight: "600" },
});
