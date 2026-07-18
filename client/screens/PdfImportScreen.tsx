import React, { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { hapticFeedback } from "@/lib/hapticFeedback";
import { usePdfImport } from "@/hooks/usePdfImport";
import { useMultiOmrJobs } from "@/hooks/useMultiOmrJobs";
import { usePractice } from "@/context/PracticeContext";
import { UploadingView } from "@/components/PdfImportProgressViews";
import { ErrorView, IdleView } from "@/components/PdfImportStateViews";

/**
 * Non-blocking import: pick → upload → queue jobs, then IMMEDIATELY return to
 * the library. The sheet is already persisted as "processing" and its card
 * shows live progress; recognition finishes in the background.
 */
export default function PdfImportScreen() {
  const navigation = useNavigation();
  const { addSheet, patchSheet, patchSheetLocal } = usePractice();
  const [showUploadTimeout, setShowUploadTimeout] = useState(false);
  // Local sheet IDs per section index — sheets are persisted at queue time.
  const sheetIdsRef = useRef<Record<number, string>>({});

  const { state, sectionTitles, pdfB64, fileName, error, startImport, reset: resetPdf } = usePdfImport();
  const multiOmrJobs = useMultiOmrJobs();

  // If the user backs out BEFORE jobs are queued (cancel mid-upload), tear the
  // hook down so no subscriptions/polls outlive an import that never started.
  // Once running, closures intentionally survive unmount to finish in background.
  const multiOmrJobsRef = useRef(multiOmrJobs);
  multiOmrJobsRef.current = multiOmrJobs;
  const jobsStartedRef = useRef(false);
  useEffect(() => {
    return () => {
      if (!jobsStartedRef.current) {
        multiOmrJobsRef.current.reset();
      }
    };
  }, []);

  // Auto-start on mount
  useEffect(() => {
    void hapticFeedback.triggerLight();
    startImport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-back on file picker cancel
  useEffect(() => {
    if (state === "error" && error === "No file selected") {
      navigation.goBack();
    }
  }, [state, error, navigation]);

  // Jobs are queued and persisted — hand the user back to the library where
  // the card shows progress. No blocking "processing" screen.
  const isRunning = multiOmrJobs.overallStatus === "running";
  useEffect(() => {
    if (isRunning) {
      jobsStartedRef.current = true;
      void hapticFeedback.triggerMedium();
      AccessibilityInfo.announceForAccessibility(
        "Recognition started. Progress is shown on the score card in your library.",
      );
      navigation.goBack();
    }
  }, [isRunning, navigation]);

  // Upload timeout handler: show warning at 30s
  useEffect(() => {
    if ((state === "uploading" || multiOmrJobs.overallStatus === "uploading") && !showUploadTimeout) {
      const timeoutId = setTimeout(() => {
        void hapticFeedback.triggerHeavy();
        setShowUploadTimeout(true);
        AccessibilityInfo.announceForAccessibility(
          "Upload is taking longer than expected. You can cancel and try again.",
        );
      }, 30000);
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [state, multiOmrJobs.overallStatus, showUploadTimeout]);

  const handleJobQueued = useCallback(
    async (index: number, jobId: string) => {
      const existingId = sheetIdsRef.current[index];
      if (existingId) {
        // Retry of an already-persisted sheet — just refresh its job pointer.
        await patchSheet(existingId, { omrStatus: "processing", omrJobId: jobId, omrProgress: 0 });
        return existingId;
      }
      const sheet = await addSheet({
        title: sectionTitles[index]?.trim() || `Section ${index + 1}`,
        artist: "",
        folder: "Musical",
        imageUris: [],
        omrStatus: "processing",
        omrJobId: jobId,
        omrProgress: 0,
      });
      sheetIdsRef.current[index] = sheet.id;
      return sheet.id;
    },
    [addSheet, patchSheet, sectionTitles],
  );

  const handleJobDone = useCallback(
    async (index: number, musicXmlUri: string, resultStoragePath: string) => {
      const sheetId = sheetIdsRef.current[index];
      if (!sheetId) return;
      await patchSheet(sheetId, { musicXmlUri, resultStoragePath, omrStatus: "ready", omrProgress: 100 });
    },
    [patchSheet],
  );

  const handleJobFailed = useCallback(
    (index: number) => {
      const sheetId = sheetIdsRef.current[index];
      if (sheetId) {
        void patchSheet(sheetId, { omrStatus: "failed" });
      }
    },
    [patchSheet],
  );

  const handleJobProgress = useCallback(
    (index: number, percent: number) => {
      const sheetId = sheetIdsRef.current[index];
      if (sheetId) {
        // Ephemeral — in-memory only; the reconcile poll re-derives it after
        // a relaunch, so it is not worth an AsyncStorage write per event.
        patchSheetLocal(sheetId, { omrProgress: percent });
      }
    },
    [patchSheetLocal],
  );

  const handleStartProcessing = useCallback(() => {
    if (!pdfB64 || sectionTitles.length === 0 || multiOmrJobs.isSubmitting) return;
    const sections = sectionTitles.map((title) => ({
      pageRange: undefined,
      title,
    }));
    multiOmrJobs.submitAll(pdfB64, sections, handleJobDone, {
      onJobQueued: handleJobQueued,
      onJobFailed: handleJobFailed,
      onJobProgress: handleJobProgress,
    });
  }, [pdfB64, sectionTitles, multiOmrJobs, handleJobDone, handleJobQueued, handleJobFailed, handleJobProgress]);

  const handleReset = useCallback(() => {
    setShowUploadTimeout(false);
    multiOmrJobs.reset();
    resetPdf();
  }, [multiOmrJobs, resetPdf]);

  // Auto-trigger OMR submission once file is ready
  useEffect(() => {
    if (state === "uploading" && pdfB64 && multiOmrJobs.overallStatus === "idle") {
      handleStartProcessing();
    }
  }, [state, pdfB64, multiOmrJobs.overallStatus, handleStartProcessing]);

  // ── Uploading (brief, blocking) ──────────────────────────────────────────
  if (
    (state === "uploading" && (multiOmrJobs.overallStatus === "idle" || isRunning)) ||
    multiOmrJobs.overallStatus === "uploading"
  ) {
    return (
      <UploadingView
        fileName={fileName}
        showUploadTimeout={showUploadTimeout}
        onRetryUpload={() => setShowUploadTimeout(false)}
        onCancel={() => navigation.goBack()}
      />
    );
  }

  // ── Upload/submit error ──────────────────────────────────────────────────
  if (state === "error" || multiOmrJobs.overallStatus === "failed") {
    const errorMsg = error ?? multiOmrJobs.error ?? "Something went wrong";
    const isUploadError = state === "error" || errorMsg.includes("Upload");
    const isTimeoutError = errorMsg.includes("did not complete") || errorMsg.includes("timeout");

    return (
      <ErrorView
        errorMsg={errorMsg}
        isUploadError={isUploadError}
        isTimeoutError={isTimeoutError}
        onRetry={handleReset}
        onCancel={() => navigation.goBack()}
      />
    );
  }

  // ── Idle/Picking (flash screen only) ─────────────────────────────────────
  return (
    <IdleView
      onGoBack={() => navigation.goBack()}
    />
  );
}
