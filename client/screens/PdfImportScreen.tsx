import React, { useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { usePdfImport } from "@/hooks/usePdfImport";
import { useMultiOmrJobs } from "@/hooks/useMultiOmrJobs";
import { usePractice } from "@/context/PracticeContext";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { ProgressTrack } from "@/components/ProgressTrack";
import { Fonts, ClayShadow } from "@/constants/theme";
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

function JobRow({ job }: { job: SectionJobState }) {
  const { colors } = useTheme();
  const statusColor = useStatusColor(job.status);
  const isActive = job.status === "processing";
  const statusText = isActive
    ? job.progressPercent > 0 ? `${job.progressPercent}%` : "Starting..."
    : JOB_STATUS_LABEL[job.status];

  return (
    <View style={styles.jobRow}>
      <View style={[styles.jobStatusCircle, { borderColor: statusColor }]}>
        <Text style={[styles.jobStatusText, { color: statusColor }]}>
          {isActive ? "●" : job.status === "done" ? "✓" : job.status === "failed" ? "✗" : "○"}
        </Text>
      </View>
      <View style={styles.jobInfo}>
        <Text style={[styles.jobTitle, { color: colors.text }]}>{job.title}</Text>
        {isActive && <ProgressTrack percent={job.progressPercent} height={3} color={statusColor} />}
        <Text style={[styles.jobStatus, { color: statusColor }]}>{statusText}</Text>
        {job.error && <Text style={[styles.jobError, { color: colors.error }]}>{job.error}</Text>}
      </View>
    </View>
  );
}

export default function PdfImportScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { addSheet } = usePractice();

  const { state, sectionTitles, pdfB64, fileName, error, startImport, reset: resetPdf } = usePdfImport();
  const multiOmrJobs = useMultiOmrJobs();

  // Auto-start on mount
  useEffect(() => {
    startImport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-back on file picker cancel
  useEffect(() => {
    if (state === "error" && error === "No file selected") {
      navigation.goBack();
    }
  }, [state, error, navigation]);

  const handleStartProcessing = useCallback(() => {
    if (!pdfB64 || sectionTitles.length === 0) return;
    const sections = sectionTitles.map((title) => ({
      pageRange: undefined,
      title,
    }));
    multiOmrJobs.submitAll(pdfB64, sections, async (index, musicXmlUri) => {
      await addSheet({
        title: sectionTitles[index] ?? `Section ${index + 1}`,
        artist: "",
        folder: "Musical",
        imageUris: [],
        musicXmlUri,
        omrStatus: "ready",
      });
    });
  }, [pdfB64, sectionTitles, multiOmrJobs, addSheet]);

  const handleReset = useCallback(() => {
    multiOmrJobs.reset();
    resetPdf();
  }, [multiOmrJobs, resetPdf]);

  // Auto-trigger OMR submission once file is ready
  useEffect(() => {
    if (state === "uploading" && pdfB64 && multiOmrJobs.overallStatus === "idle") {
      handleStartProcessing();
    }
  }, [state, pdfB64, multiOmrJobs.overallStatus, handleStartProcessing]);

  // ── Uploading ────────────────────────────────────────────────────────────
  if ((state === "uploading" && multiOmrJobs.overallStatus === "idle") || multiOmrJobs.overallStatus === "uploading") {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.backgroundDefault }]}>
        <LoadingOverlay
          message="Uploading PDF…"
          subMessage={fileName ?? "Preparing for recognition…"}
        />
      </SafeAreaView>
    );
  }

  // ── Processing/Running ───────────────────────────────────────────────────
  if (multiOmrJobs.overallStatus === "running") {
    const { jobs } = multiOmrJobs;
    const overallPercent =
      jobs.length > 0 ? Math.round(jobs.reduce((sum, j) => sum + j.progressPercent, 0) / jobs.length) : 0;

    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.backgroundDefault }]}>
        <LoadingOverlay
          message="Recognizing music…"
          subMessage={`${jobs.filter((j) => j.status === "done").length}/${jobs.length} sections complete`}
          progress={overallPercent}
        />
        <View style={styles.jobsList}>
          {jobs.map((job, i) => (
            <JobRow key={i} job={job} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  if (multiOmrJobs.overallStatus === "done") {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.backgroundDefault }]}>
        <Text style={[styles.successText, { color: colors.text }]}>All sections ready!</Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>View Library</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (state === "error" || multiOmrJobs.overallStatus === "failed") {
    const errorMsg = error ?? multiOmrJobs.error ?? "Something went wrong";
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.backgroundDefault }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{errorMsg}</Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleReset}
        >
          <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Idle/Picking (flash screen only) ─────────────────────────────────────
  return (
    <SafeAreaView style={[styles.center, { backgroundColor: colors.backgroundDefault }]}>
      <LoadingOverlay message="Opening file picker…" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  successText: { fontSize: 22, fontFamily: Fonts.heading, fontWeight: "700", marginBottom: 24 },
  errorText: { fontSize: 16, fontFamily: Fonts.body, marginBottom: 16, textAlign: "center" },
  primaryButton: { borderRadius: 50, paddingVertical: 14, paddingHorizontal: 24, alignItems: "center", ...ClayShadow },
  primaryButtonText: { fontSize: 16, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
  secondaryButton: { paddingVertical: 10, alignItems: "center", marginTop: 8 },
  secondaryButtonText: { fontSize: 15, fontFamily: Fonts.body },
  jobsList: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, maxHeight: 240, borderRadius: 32 },
  jobRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  jobStatusCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 4 },
  jobStatusText: { fontSize: 14, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
  jobInfo: { flex: 1, gap: 4 },
  jobTitle: { fontSize: 14, fontFamily: Fonts.bodySemiBold, fontWeight: "600" },
  jobStatus: { fontSize: 11, fontFamily: Fonts.body },
  jobError: { fontSize: 11, fontFamily: Fonts.body },
});
