import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { ProgressTrack } from "@/components/ProgressTrack";
import { Fonts, Spacing, BorderRadius } from "@/constants/theme";
import type { SectionJobState } from "@/hooks/useMultiOmrJobs";

const JOB_STATUS_LABEL: Record<SectionJobState["status"], string> = {
  pending: "Waiting...",
  queued: "Queued",
  processing: "Processing",
  done: "Complete",
  failed: "Failed",
};

function useStatusColor(status: SectionJobState["status"]): string {
  const { colors } = useTheme();
  const map: Record<SectionJobState["status"], string> = {
    pending: colors.textSecondary,
    queued: colors.warning,
    processing: colors.primary,
    done: colors.success,
    failed: colors.error,
  };
  return map[status];
}

interface JobRowProps {
  job: SectionJobState;
  onRetry: () => void;
}

export function JobRowItem({ job, onRetry }: JobRowProps) {
  const { colors } = useTheme();
  const statusColor = useStatusColor(job.status);
  const isActive = job.status === "processing";
  const statusText = isActive
    ? job.progressPercent > 0 ? `${job.progressPercent}%` : "Starting..."
    : JOB_STATUS_LABEL[job.status];
  const isFailed = job.status === "failed";

  return (
    <View
      style={styles.jobRow}
      accessible={true}
      accessibilityLabel={`${job.title}, ${JOB_STATUS_LABEL[job.status]}`}
    >
      <View style={[styles.jobStatusCircle, { borderColor: statusColor }]}>
        <Text style={[styles.jobStatusText, { color: statusColor }]}>
          {isActive ? "●" : job.status === "done" ? "✓" : job.status === "failed" ? "✗" : "○"}
        </Text>
      </View>
      <View style={styles.jobInfo}>
        <Text style={[styles.jobTitle, { color: colors.text }]}>{job.title}</Text>
        {isActive && (
          <ProgressTrack percent={job.progressPercent} height={3} color={statusColor} />
        )}
        <Text style={[styles.jobStatus, { color: statusColor }]}>{statusText}</Text>
        {job.error && (
          <View style={styles.jobErrorSection}>
            <Text style={[styles.jobError, { color: colors.error }]}>{job.error}</Text>
            {isFailed && (
              <Pressable
                onPress={onRetry}
                style={[styles.retryButton, { borderColor: colors.primary }]}
                accessibilityLabel={`Retry ${job.title} recognition`}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.retryButtonText, { color: colors.primary }]}>Retry</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  jobRow: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  jobStatusCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  jobStatusText: { fontSize: 14, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
  jobInfo: { flex: 1, gap: 4 },
  jobTitle: { fontSize: 14, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
  jobStatus: { fontSize: 11, fontFamily: Fonts.body },
  jobError: { fontSize: 11, fontFamily: Fonts.body, marginBottom: Spacing.sm },
  jobErrorSection: { gap: Spacing.sm },
  retryButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    alignSelf: "flex-start",
    minHeight: 32,
    justifyContent: "center",
  },
  retryButtonText: { fontSize: 13, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
});
