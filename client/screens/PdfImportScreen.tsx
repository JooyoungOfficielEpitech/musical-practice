import React, { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { hapticFeedback } from "@/lib/hapticFeedback";
import { usePdfImport } from "@/hooks/usePdfImport";
import { useMultiOmrJobs } from "@/hooks/useMultiOmrJobs";
import { usePractice } from "@/context/PracticeContext";
import { UploadingView } from "@/components/PdfImportProgressViews";
import { ErrorView } from "@/components/PdfImportStateViews";
import { ImportLandingView, ImportConfirmView } from "@/components/PdfImportSetupViews";

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

  const {
    state, sectionTitles, pdfB64, fileName, fileSizeBytes, pageCount, defaultTitle,
    error, startImport, confirmImport, reset: resetPdf,
  } = usePdfImport();
  const [titleDraft, setTitleDraft] = useState("");
  // Prefill the editable title whenever a newly picked file reaches confirm.
  useEffect(() => {
    if (state === "confirm") setTitleDraft(defaultTitle);
  }, [state, defaultTitle]);
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

  // No surprise picker on mount and no silent pop on cancel — the landing
  // screen explains what to pick and stays put until the user chooses.

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

  // ── Confirm (file picked — name it, see size/pages, start the scan) ──────
  if (state === "confirm" && fileName) {
    return (
      <ImportConfirmView
        fileName={fileName}
        fileSizeBytes={fileSizeBytes}
        pageCount={pageCount}
        title={titleDraft}
        onTitleChange={setTitleDraft}
        onStart={() => confirmImport(titleDraft)}
        onChooseDifferent={() => {
          void startImport();
        }}
      />
    );
  }

  // ── Landing (idle/picking) ───────────────────────────────────────────────
  return (
    <ImportLandingView
      isPicking={state === "picking"}
      onChoose={() => {
        void startImport();
      }}
      onGoBack={() => navigation.goBack()}
    />
  );
}
