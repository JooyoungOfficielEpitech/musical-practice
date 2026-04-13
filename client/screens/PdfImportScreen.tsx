import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { usePdfImport } from "@/hooks/usePdfImport";
import { useMultiOmrJobs } from "@/hooks/useMultiOmrJobs";
import { usePractice } from "@/context/PracticeContext";
import { PageThumbnailGrid } from "@/components/PageThumbnailGrid";
import type { SectionJobState } from "@/hooks/useMultiOmrJobs";

const JOB_ICON: Record<SectionJobState["status"], string> = {
  pending: "○", queued: "◌", processing: "◎", done: "✓", failed: "✗",
};

const JOB_STATUS_LABEL: Record<SectionJobState["status"], string> = {
  pending: "Waiting to start…",
  queued: "Queued — starting soon…",
  processing: "Recognizing notes…",
  done: "Complete",
  failed: "Failed",
};

const JOB_STATUS_COLOR: Record<SectionJobState["status"], string> = {
  pending: "#888",
  queued: "#F0A500",
  processing: "#4A9EFF",
  done: "#34C759",
  failed: "#FF3B30",
};

const PROCESSING_STEPS = [
  "Analyzing page layout…",
  "Detecting staff lines…",
  "Identifying note heads…",
  "Recognizing rhythms…",
  "Parsing musical symbols…",
  "Building MusicXML…",
];

function AnimatedProcessingLabel({ color }: { color: string }) {
  const [stepIndex, setStepIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    const cycle = () => {
      if (cancelled) return;
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        if (!cancelled) {
          setStepIndex((i) => (i + 1) % PROCESSING_STEPS.length);
          setTimeout(cycle, 2000);
        }
      });
    };
    const t = setTimeout(cycle, 2500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [fadeAnim]);

  return (
    <Animated.Text style={[styles.jobStatusLabel, { color, opacity: fadeAnim }]}>
      {PROCESSING_STEPS[stepIndex]}
    </Animated.Text>
  );
}

function JobRow({ job }: { job: SectionJobState }) {
  const isActive = job.status === "processing";
  return (
    <View style={styles.jobRow}>
      <View style={[styles.jobIconWrap, { borderColor: JOB_STATUS_COLOR[job.status] }]}>
        {isActive
          ? <ActivityIndicator size="small" color={JOB_STATUS_COLOR[job.status]} />
          : <Text style={[styles.jobIcon, { color: JOB_STATUS_COLOR[job.status] }]}>{JOB_ICON[job.status]}</Text>}
      </View>
      <View style={styles.jobInfo}>
        <Text style={styles.jobTitle}>{job.title}</Text>
        {isActive
          ? <AnimatedProcessingLabel color={JOB_STATUS_COLOR[job.status]} />
          : <Text style={[styles.jobStatusLabel, { color: JOB_STATUS_COLOR[job.status] }]}>
              {JOB_STATUS_LABEL[job.status]}
            </Text>}
        {job.error && <Text style={styles.jobError}>{job.error}</Text>}
      </View>
    </View>
  );
}

export default function PdfImportScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { addSheet } = usePractice();

  const {
    state,
    chunks,
    pageRanges,
    sectionTitles,
    pdfB64,
    error,
    startImport,
    setPageRanges,
    setSectionTitle,
    proceedToNaming,
    reset: resetPdf,
  } = usePdfImport();

  // Auto-start the file picker when the screen mounts
  useEffect(() => {
    startImport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If user cancelled the picker (no file chosen), go back
  useEffect(() => {
    if (state === "error" && error === "No file selected") {
      navigation.goBack();
    }
  }, [state, error, navigation]);

  const multiOmrJobs = useMultiOmrJobs();

  const handleStartProcessing = useCallback(() => {
    if (!pdfB64) return;
    const effectiveRanges =
      pageRanges.length > 0
        ? pageRanges
        : chunks.length > 0
          ? [[chunks[0].pageRange[0], chunks[chunks.length - 1].pageRange[1]] as [number, number]]
          : [[1, 1] as [number, number]];
    const sections = effectiveRanges.map((range, i) => ({
      pageRange: range,
      title: sectionTitles[i] ?? `Section ${i + 1}`,
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
  }, [pdfB64, pageRanges, sectionTitles, multiOmrJobs, addSheet]);

  const handleReset = useCallback(() => {
    multiOmrJobs.reset();
    resetPdf();
  }, [multiOmrJobs, resetPdf]);

  // ── Running / done / failed (multi-job active) ────────────────────────────
  if (multiOmrJobs.overallStatus === "running") {
    const doneCount = multiOmrJobs.jobs.filter((j) => j.status === "done").length;
    const total = multiOmrJobs.jobs.length;
    const progressPercent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    const activeJob = multiOmrJobs.jobs.find((j) => j.status === "processing");
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.backgroundDefault }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Recognizing Music</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {activeJob ? `Processing "${activeJob.title}"` : `${doneCount} of ${total} section${total !== 1 ? "s" : ""} done`}
          </Text>
        </View>
        <View style={styles.progressBarWrap}>
          <View style={[styles.progressBarTrack, { backgroundColor: colors.borderLight }]}>
            <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${progressPercent}%` }]} />
          </View>
          <Text style={[styles.progressPercent, { color: colors.textSecondary }]}>{progressPercent}%</Text>
        </View>
        <FlatList
          data={multiOmrJobs.jobs}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <JobRow job={item} />}
          contentContainerStyle={styles.jobList}
        />
        <View style={styles.processingFootnote}>
          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={[styles.processingFootnoteText, { color: colors.textSecondary }]}>
            OMR processing may take a minute per section
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (multiOmrJobs.overallStatus === "done" || multiOmrJobs.overallStatus === "failed") {
    const isDone = multiOmrJobs.overallStatus === "done";
    const failedCount = multiOmrJobs.jobs.filter((j) => j.status === "failed").length;
    const errorMessage = multiOmrJobs.error ?? `${failedCount} section${failedCount !== 1 ? "s" : ""} failed`;
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.backgroundDefault }]}>
        <Text style={[isDone ? styles.successText : styles.errorText, { color: isDone ? colors.text : colors.error }]}>
          {isDone ? "All sections ready!" : errorMessage}
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={isDone ? () => navigation.goBack() : handleReset}
        >
          <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>
            {isDone ? "View Library" : "Start Over"}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Naming step ───────────────────────────────────────────────────────────
  if (state === "naming") {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.backgroundDefault }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Name Each Section</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {sectionTitles.length} section{sectionTitles.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <FlatList
          data={sectionTitles}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item, index }) => (
            <View style={styles.titleRow}>
              <Text style={[styles.titleIndex, { color: colors.textSecondary }]}>{index + 1}.</Text>
              <TextInput
                style={[styles.titleInput, { color: colors.text, borderColor: colors.borderLight }]}
                value={item}
                onChangeText={(t) => setSectionTitle(index, t)}
              />
            </View>
          )}
          contentContainerStyle={styles.jobList}
        />
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleStartProcessing}
          >
            <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>
              Start Processing
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
            <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
              Start Over
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Selecting step ────────────────────────────────────────────────────────
  if (state === "selecting") {
    const rangeCount = pageRanges.length || 1;
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.backgroundDefault }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Select Number Boundaries</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Tap between pages to split · {rangeCount} section{rangeCount !== 1 ? "s" : ""}
          </Text>
        </View>
        <PageThumbnailGrid
          chunks={chunks}
          pageRanges={pageRanges}
          onPageRangesChange={setPageRanges}
        />
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={proceedToNaming}
          >
            <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>
              Confirm {rangeCount} Section{rangeCount !== 1 ? "s" : ""}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
            <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
              Start Over
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Loading states ────────────────────────────────────────────────────────
  if (state === "picking" || state === "uploading") {
    const label = state === "picking" ? "Opening file picker…" : "Loading PDF…";
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.backgroundDefault }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{label}</Text>
      </SafeAreaView>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (state === "error") {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.backgroundDefault }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error ?? "Something went wrong"}</Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={startImport}
        >
          <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Idle (should never be seen — auto-start fires on mount) ───────────────
  return (
    <SafeAreaView style={[styles.center, { backgroundColor: colors.backgroundDefault }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  header: { padding: 20, paddingBottom: 8 },
  footer: { padding: 16, gap: 8 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 14 },
  successText: { fontSize: 22, fontWeight: "700", marginBottom: 24 },
  errorText: { fontSize: 16, marginBottom: 16, textAlign: "center" },
  loadingText: { marginTop: 16, fontSize: 15 },
  primaryButton: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, alignItems: "center" },
  primaryButtonText: { fontSize: 16, fontWeight: "600" },
  secondaryButton: { paddingVertical: 10, alignItems: "center" },
  secondaryButtonText: { fontSize: 15 },
  jobList: { padding: 16, gap: 12 },
  jobRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  jobIconWrap: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  jobIcon: { fontSize: 16, textAlign: "center" },
  jobInfo: { flex: 1 },
  jobTitle: { fontSize: 15, fontWeight: "600" },
  jobStatusLabel: { fontSize: 12, marginTop: 2 },
  jobError: { fontSize: 11, color: "#FF3B30", marginTop: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  titleIndex: { fontSize: 14, width: 24 },
  titleInput: { flex: 1, fontSize: 15, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  progressBarWrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
  progressBarTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 3 },
  progressPercent: { fontSize: 12, width: 34, textAlign: "right" },
  processingFootnote: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 16 },
  processingFootnoteText: { fontSize: 12 },
});

