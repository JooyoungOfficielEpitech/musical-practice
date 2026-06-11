import React from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { JobRowItem } from "@/components/JobRowItem";
import { Fonts, ClayShadow, Spacing, BorderRadius } from "@/constants/theme";
import type { SectionJobState } from "@/hooks/useMultiOmrJobs";

interface UploadingViewProps {
  fileName: string | null;
  showUploadTimeout: boolean;
  onRetryUpload: () => void;
  onCancel: () => void;
}

export function UploadingView({
  fileName,
  showUploadTimeout,
  onRetryUpload,
  onCancel,
}: UploadingViewProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: colors.backgroundDefault }]}
      edges={["top", "bottom"]}
    >
      {showUploadTimeout ? (
        <View style={[styles.flex, styles.center]}>
          <Text style={[styles.errorText, { color: colors.warning }]}>
            Upload is taking longer than expected
          </Text>
          <Pressable
            onPress={onRetryUpload}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            accessibilityLabel="Retry upload"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>
              Retry Upload
            </Text>
          </Pressable>
          <Pressable
            onPress={onCancel}
            style={styles.secondaryButton}
            accessibilityLabel="Cancel upload"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
              Cancel
            </Text>
          </Pressable>
        </View>
      ) : (
        <LoadingOverlay
          message="Uploading PDF…"
          subMessage={fileName ?? "Preparing for recognition…"}
        />
      )}
    </SafeAreaView>
  );
}

interface ProcessingViewProps {
  jobs: SectionJobState[];
  onRetry: (index: number) => void;
}

export function ProcessingView({
  jobs,
  onRetry,
}: ProcessingViewProps): React.JSX.Element {
  const { colors } = useTheme();
  const overallPercent =
    jobs.length > 0 ? Math.round(jobs.reduce((sum, j) => sum + j.progressPercent, 0) / jobs.length) : 0;

  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: colors.backgroundDefault }]}
      edges={["top", "bottom"]}
    >
      <LoadingOverlay
        message="Recognizing music…"
        subMessage={`${jobs.filter((j) => j.status === "done").length}/${jobs.length} sections complete`}
        progress={overallPercent}
      />
      <FlatList
        data={jobs}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item, index }) => (
          <JobRowItem job={item} onRetry={() => onRetry(index)} />
        )}
        style={styles.jobsList}
        scrollEnabled={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorText: { fontSize: 16, fontFamily: Fonts.body, marginBottom: 12, textAlign: "center" },
  primaryButton: {
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    paddingHorizontal: 24,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
    ...ClayShadow,
  },
  primaryButtonText: { fontSize: 16, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
  secondaryButton: {
    paddingVertical: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.md,
    minHeight: 44,
    justifyContent: "center",
  },
  secondaryButtonText: { fontSize: 15, fontFamily: Fonts.body },
  jobsList: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: 8, maxHeight: 240 },
});
