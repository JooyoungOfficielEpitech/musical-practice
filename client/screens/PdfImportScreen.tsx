import React, { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { hapticFeedback } from "@/lib/hapticFeedback";
import { usePdfImport } from "@/hooks/usePdfImport";
import { useMultiOmrJobs } from "@/hooks/useMultiOmrJobs";
import { usePractice } from "@/context/PracticeContext";
import {
  UploadingView,
  ProcessingView,
} from "@/components/PdfImportProgressViews";
import {
  SuccessView,
  ErrorView,
  IdleView,
} from "@/components/PdfImportStateViews";

export default function PdfImportScreen() {
  const navigation = useNavigation();
  const { addSheet, patchSheet } = usePractice();
  const [showUploadTimeout, setShowUploadTimeout] = useState(false);
  // Local sheet IDs per section index — sheets are persisted at queue time.
  const sheetIdsRef = useRef<Record<number, string>>({});

  const { state, sectionTitles, pdfB64, fileName, error, startImport, reset: resetPdf } = usePdfImport();
  const multiOmrJobs = useMultiOmrJobs();

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

  // Success haptic — top-level effect (hooks must never live in render branches)
  const isDone = multiOmrJobs.overallStatus === "done";
  useEffect(() => {
    if (isDone) {
      void hapticFeedback.triggerMedium();
    }
  }, [isDone]);

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
        await patchSheet(existingId, { omrStatus: "processing", omrJobId: jobId });
        return existingId;
      }
      const sheet = await addSheet({
        title: sectionTitles[index]?.trim() || `Section ${index + 1}`,
        artist: "",
        folder: "Musical",
        imageUris: [],
        omrStatus: "processing",
        omrJobId: jobId,
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
      await patchSheet(sheetId, { musicXmlUri, resultStoragePath, omrStatus: "ready" });
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

  const handleStartProcessing = useCallback(() => {
    if (!pdfB64 || sectionTitles.length === 0 || multiOmrJobs.isSubmitting) return;
    const sections = sectionTitles.map((title) => ({
      pageRange: undefined,
      title,
    }));
    multiOmrJobs.submitAll(pdfB64, sections, handleJobDone, {
      onJobQueued: handleJobQueued,
      onJobFailed: handleJobFailed,
    });
  }, [pdfB64, sectionTitles, multiOmrJobs, handleJobDone, handleJobQueued, handleJobFailed]);

  const handleReset = useCallback(() => {
    setShowUploadTimeout(false);
    multiOmrJobs.reset();
    resetPdf();
  }, [multiOmrJobs, resetPdf]);

  const handleRetry = useCallback(
    (index: number) => {
      multiOmrJobs.retry(index);
    },
    [multiOmrJobs],
  );

  // Auto-trigger OMR submission once file is ready
  useEffect(() => {
    if (state === "uploading" && pdfB64 && multiOmrJobs.overallStatus === "idle") {
      handleStartProcessing();
    }
  }, [state, pdfB64, multiOmrJobs.overallStatus, handleStartProcessing]);

  // ── Uploading ────────────────────────────────────────────────────────────
  if ((state === "uploading" && multiOmrJobs.overallStatus === "idle") || multiOmrJobs.overallStatus === "uploading") {
    return (
      <UploadingView
        fileName={fileName}
        showUploadTimeout={showUploadTimeout}
        onRetryUpload={() => setShowUploadTimeout(false)}
        onCancel={() => navigation.goBack()}
      />
    );
  }

  // ── Processing/Running ───────────────────────────────────────────────────
  if (multiOmrJobs.overallStatus === "running") {
    return (
      <ProcessingView
        jobs={multiOmrJobs.jobs}
        onRetry={handleRetry}
        onContinueInBackground={() => navigation.goBack()}
      />
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  if (multiOmrJobs.overallStatus === "done") {
    return (
      <SuccessView
        onViewLibrary={() => navigation.goBack()}
      />
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
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
