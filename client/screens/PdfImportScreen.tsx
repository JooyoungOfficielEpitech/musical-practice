import React, { useCallback, useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useNavigation } from "@react-navigation/native";
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
  const { addSheet } = usePractice();
  const [uploadTimeoutId, setUploadTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [showUploadTimeout, setShowUploadTimeout] = useState(false);

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

  // Upload timeout handler: show warning at 30s
  useEffect(() => {
    if ((state === "uploading" || multiOmrJobs.overallStatus === "uploading") && !showUploadTimeout) {
      const timeoutId = setTimeout(() => {
        setShowUploadTimeout(true);
        AccessibilityInfo.announceForAccessibility(
          "Upload is taking longer than expected. You can cancel and try again.",
        );
      }, 30000);
      setUploadTimeoutId(timeoutId);
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [state, multiOmrJobs.overallStatus, showUploadTimeout]);

  const handleStartProcessing = useCallback(() => {
    if (!pdfB64 || sectionTitles.length === 0 || multiOmrJobs.isSubmitting) return;
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
    setShowUploadTimeout(false);
    if (uploadTimeoutId) {
      clearTimeout(uploadTimeoutId);
      setUploadTimeoutId(null);
    }
    multiOmrJobs.reset();
    resetPdf();
  }, [multiOmrJobs, resetPdf, uploadTimeoutId]);

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
