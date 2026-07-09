/**
 * useMultiOmrJobs — orchestrates N parallel OMR jobs for a multi-section PDF import.
 *
 * Flow: upload PDF once → submit N jobs (one per section) → track via Supabase Realtime
 *       → call onJobDone(index, musicXmlUri) as each job completes.
 */
import { useCallback, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { supabase } from "@/lib/supabase";
import { submitOmrJob, uploadPdfToStorage } from "@/lib/omrQueue";
import { checkAllSettled } from "@/lib/omrJobPolling";
import { subscribeOmrJob } from "@/lib/omrJobSubscription";
import type { PageRange } from "@/lib/pdfImport";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SectionInput {
  pageRange?: PageRange; // undefined = whole document (server processes all pages)
  title: string;
}

export type MultiJobStatus = "idle" | "uploading" | "running" | "done" | "failed";

export interface SectionJobState {
  title: string;
  status: "pending" | "queued" | "processing" | "done" | "failed";
  pageRange: [number, number] | null; // null = whole document
  progressPercent: number; // 0–100, written by server via Supabase Realtime
  startedAt?: number;      // epoch ms when job first entered "processing"
  musicXmlUri?: string;
  error?: string;
}

export interface JobLifecycle {
  /** Called as soon as a job row exists. Return a local sheet ID to use for
   *  result file naming — this is how imports persist before completion. */
  onJobQueued?: (index: number, jobId: string) => Promise<string | void>;
  onJobFailed?: (index: number, error: string) => void;
}

export interface UseMultiOmrJobsResult {
  overallStatus: MultiJobStatus;
  jobs: SectionJobState[];
  error: string | null;
  isSubmitting: boolean;
  submitAll: (
    pdfB64: string,
    sections: SectionInput[],
    onJobDone: (index: number, musicXmlUri: string, resultStoragePath: string) => Promise<void>,
    lifecycle?: JobLifecycle,
  ) => void;
  retry: (index: number) => Promise<void>;
  reset: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMultiOmrJobs(): UseMultiOmrJobsResult {
  const [overallStatus, setOverallStatus] = useState<MultiJobStatus>("idle");
  const [jobs, setJobs] = useState<SectionJobState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  type Channel = ReturnType<NonNullable<typeof supabase>["channel"]>;
  const channelsRef = useRef<Channel[]>([]);
  const pollsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const submitContextRef = useRef<{
    pdfB64: string;
    sections: SectionInput[];
    onJobDone: (index: number, musicXmlUri: string, resultStoragePath: string) => Promise<void>;
    lifecycle?: JobLifecycle;
  } | null>(null);

  const _unsubscribeAll = useCallback(() => {
    channelsRef.current.forEach((ch) => ch.unsubscribe());
    channelsRef.current = [];
    pollsRef.current.forEach((id) => clearInterval(id));
    pollsRef.current = [];
  }, []);

  const _updateJob = useCallback(
    (index: number, patch: Partial<SectionJobState>) => {
      setJobs((prev) => prev.map((j, i) => (i === index ? { ...j, ...patch } : j)));
    },
    [],
  );

  const _settleJob = useCallback(
    (index: number, patch: Partial<SectionJobState>) => {
      setJobs((prev) => {
        const next = prev.map((j, i) => (i === index ? { ...j, ...patch } : j));
        const { allSettled, shouldBeDone } = checkAllSettled(next);
        if (allSettled) setOverallStatus(shouldBeDone ? "done" : "failed");
        return next;
      });
    },
    [],
  );

  const _subscribeJob = useCallback(
    (
      jobId: string,
      index: number,
      sheetId: string,
      onJobDone: (index: number, musicXmlUri: string, resultStoragePath: string) => Promise<void>,
    ) => {
      subscribeOmrJob(jobId, index, sheetId, onJobDone, {
        updateJob: _updateJob,
        settleJob: _settleJob,
        sectionTitle: (i) => submitContextRef.current?.sections[i]?.title ?? `section ${i + 1}`,
        registerChannel: (ch) => channelsRef.current.push(ch as Channel),
        registerPoll: (id) => pollsRef.current.push(id),
        onJobFailed: (i, error) => submitContextRef.current?.lifecycle?.onJobFailed?.(i, error),
      });
    },
    [_updateJob, _settleJob],
  );

  const submitAll = useCallback(
    (
      pdfB64: string,
      sections: SectionInput[],
      onJobDone: (index: number, musicXmlUri: string, resultStoragePath: string) => Promise<void>,
      lifecycle?: JobLifecycle,
    ) => {
      // Guard against double-tap: if already submitting, return early
      if (isSubmitting) return;

      setIsSubmitting(true);
      submitContextRef.current = { pdfB64, sections, onJobDone, lifecycle };
      setOverallStatus("uploading");
      setJobs(sections.map((s) => ({
        title: s.title, status: "pending", pageRange: s.pageRange ?? null, progressPercent: 0,
      })));

      (async () => {
        try {
          const tempId = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const storagePath = await uploadPdfToStorage(pdfB64, tempId);

          for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const jobId = await submitOmrJob(storagePath, section.pageRange ? [section.pageRange] : []);
            // Persist the sheet NOW (omrStatus "processing") so leaving the
            // screen or killing the app never loses the import.
            const persistedId = await lifecycle?.onJobQueued?.(i, jobId);
            const sheetId = typeof persistedId === "string" ? persistedId : `section-${Date.now()}-${i}`;
            _updateJob(i, { status: "queued" });
            _subscribeJob(jobId, i, sheetId, onJobDone);
          }

          setOverallStatus("running");
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upload failed";
          if (__DEV__) {
            console.error("[useMultiOmrJobs] submitAll failed:", err);
          }
          setError(message);
          setJobs((prev) => prev.map((j) => ({ ...j, status: "failed" as const, error: message })));
          setOverallStatus("failed");
        } finally {
          setIsSubmitting(false);
        }
      })();
    },
    [_updateJob, _subscribeJob, isSubmitting],
  );

  const retry = useCallback(
    async (index: number) => {
      const context = submitContextRef.current;
      if (!context || index < 0 || index >= context.sections.length) {
        return;
      }

      const section = context.sections[index];
      setJobs((prev) =>
        prev.map((j, i) =>
          i === index ? { ...j, status: "pending", progressPercent: 0, error: undefined } : j,
        ),
      );

      try {
        const tempId = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const storagePath = await uploadPdfToStorage(context.pdfB64, tempId);
        const jobId = await submitOmrJob(storagePath, section.pageRange ? [section.pageRange] : []);
        const persistedId = await context.lifecycle?.onJobQueued?.(index, jobId);
        const sheetId = typeof persistedId === "string" ? persistedId : `section-${Date.now()}-${index}`;

        _updateJob(index, { status: "queued" });
        _subscribeJob(jobId, index, sheetId, context.onJobDone);

        AccessibilityInfo.announceForAccessibility(
          `Retrying recognition for ${section.title}`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Retry failed";
        _updateJob(index, { status: "failed", error: message });
        AccessibilityInfo.announceForAccessibility(
          `Retry failed for ${section.title}: ${message}`,
        );
      }
    },
    [_updateJob, _subscribeJob],
  );

  const reset = useCallback(() => {
    _unsubscribeAll();
    submitContextRef.current = null;
    setOverallStatus("idle");
    setJobs([]);
    setError(null);
    setIsSubmitting(false);
  }, [_unsubscribeAll]);

  return { overallStatus, jobs, error, isSubmitting, submitAll, retry, reset };
}
