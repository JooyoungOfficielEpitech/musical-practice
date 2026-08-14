import React from "react";
import { StyleSheet, Text, View, Pressable, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { hapticFeedback } from "@/lib/hapticFeedback";
import { Fonts, Spacing, BorderRadius, Typography, ClayShadowSmall } from "@/constants/theme";

const LONG_SCORE_PAGES = 12;

export function formatFileSize(bytes: number | null): string | null {
  if (bytes === null || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface LandingViewProps {
  onChoose: () => void;
  onGoBack: () => void;
  isPicking: boolean;
}

/** Import landing: what to pick and what happens next — no surprise picker. */
export function ImportLandingView({ onChoose, onGoBack, isPicking }: LandingViewProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundDefault }]} edges={["top", "bottom"]}>
      <Pressable
        onPress={onGoBack}
        accessibilityLabel="Back to library"
        accessibilityRole="button"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={[styles.backBtn, { backgroundColor: colors.surface }]}
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <View style={styles.center}>
        <Ionicons name="document-text-outline" size={56} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>Import a PDF score</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          Pick a PDF of sheet music — vocal and choir scores work best.{"\n"}
          We split it into parts you can practice, with lyrics when printed.{"\n"}
          Scanning runs in the background and usually takes a few minutes.
        </Text>
        <Pressable
          onPress={() => {
            void hapticFeedback.triggerMedium();
            onChoose();
          }}
          disabled={isPicking}
          accessibilityLabel="Choose PDF"
          accessibilityRole="button"
          accessibilityState={{ disabled: isPicking, busy: isPicking }}
          android_ripple={{ color: colors.rippleLight }}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.primary, opacity: isPicking ? 0.6 : pressed ? 0.9 : 1 },
          ]}
        >
          <Ionicons name="folder-open-outline" size={18} color={colors.buttonText} />
          <Text style={[styles.primaryBtnText, { color: colors.buttonText }]}>
            {isPicking ? "Opening…" : "Choose PDF"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

interface ConfirmViewProps {
  fileName: string;
  fileSizeBytes: number | null;
  pageCount: number | null;
  title: string;
  onTitleChange: (title: string) => void;
  onStart: () => void;
  onChooseDifferent: () => void;
}

/** Pre-scan confirmation: file facts + editable score title. */
export function ImportConfirmView({
  fileName, fileSizeBytes, pageCount, title, onTitleChange, onStart, onChooseDifferent,
}: ConfirmViewProps): React.JSX.Element {
  const { colors } = useTheme();
  const sizeLabel = formatFileSize(fileSizeBytes);
  const facts = [pageCount !== null ? `${pageCount} page${pageCount === 1 ? "" : "s"}` : null, sizeLabel]
    .filter(Boolean)
    .join(" · ");

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundDefault }]} edges={["top", "bottom"]}>
      <View style={styles.center}>
        <View style={[styles.fileCard, { backgroundColor: colors.surface }, ClayShadowSmall]}>
          <Ionicons name="document-text" size={28} color={colors.primary} />
          <View style={styles.fileInfo}>
            <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={2}>{fileName}</Text>
            {!!facts && <Text style={[styles.fileFacts, { color: colors.textSecondary }]}>{facts}</Text>}
          </View>
        </View>

        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>SCORE TITLE</Text>
        <TextInput
          value={title}
          onChangeText={onTitleChange}
          placeholder="Name this score"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Score title"
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.borderLight }]}
        />

        {pageCount !== null && pageCount > LONG_SCORE_PAGES && (
          <View style={styles.warnRow}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.warnText, { color: colors.textSecondary }]}>
              Long score — scanning will take a while. It runs in the background, so feel free to keep using the app.
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => {
            void hapticFeedback.triggerMedium();
            onStart();
          }}
          accessibilityLabel="Start scan"
          accessibilityRole="button"
          android_ripple={{ color: colors.rippleLight }}
          style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}
        >
          <Ionicons name="sparkles-outline" size={18} color={colors.buttonText} />
          <Text style={[styles.primaryBtnText, { color: colors.buttonText }]}>Start scan</Text>
        </Pressable>
        <Pressable
          onPress={onChooseDifferent}
          accessibilityLabel="Choose a different PDF"
          accessibilityRole="button"
          style={styles.secondaryBtn}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Choose a different PDF</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.xl },
  backBtn: {
    width: 44, height: 44, borderRadius: BorderRadius.sm,
    alignItems: "center", justifyContent: "center", marginTop: Spacing.md,
  },
  center: { flex: 1, justifyContent: "center", gap: Spacing.md },
  title: { ...Typography.h3, textAlign: "center" },
  message: { ...Typography.body, textAlign: "center", lineHeight: 22 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm,
    paddingVertical: Spacing.md, borderRadius: 50, marginTop: Spacing.md, minHeight: 48,
  },
  primaryBtnText: { fontSize: 16, fontFamily: Fonts.bodyBold, fontWeight: "700" },
  secondaryBtn: { alignItems: "center", paddingVertical: Spacing.md, minHeight: 44 },
  secondaryBtnText: { ...Typography.body },
  fileCard: {
    flexDirection: "row", alignItems: "center", gap: Spacing.md,
    padding: Spacing.lg, borderRadius: BorderRadius.md,
  },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 15, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
  fileFacts: { ...Typography.small, marginTop: 2 },
  inputLabel: { ...Typography.label, marginTop: Spacing.sm },
  input: {
    borderWidth: 1, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: 16, minHeight: 48,
  },
  warnRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.xs },
  warnText: { ...Typography.small, flex: 1 },
});
