/**
 * useMultiOmrJobs — orchestrates N parallel OMR jobs for a multi-section PDF import.
 *
 * Flow: upload PDF once → submit N jobs (one per section) → track via Realtime
 *       → call onJobDone(index, musicXmlUri) as each job completes.
 */
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { downloadResult, submitOmrJob, uploadPdfToStorage } from "@/lib/omrQueue";
import type { PageRange } from "@/lib/pdfImport";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SectionInput {
  pageRange: PageRange;
  title: string;
}

export type MultiJobStatus = "idle" | "uploading" | "running" | "done" | "failed";

export interface SectionJobState {
  title: string;
  status: "pending" | "queued" | "processing" | "done" | "failed";
  pageRange: [number, number];
  startedAt?: number; // epoch ms when job entered "processing"
  musicXmlUri?: string;
  error?: string;
}

export interface UseMultiOmrJobsResult {
  overallStatus: MultiJobStatus;
  jobs: SectionJobState[];
  error: string | null;
  submitAll: (
    pdfB64: string,
    sections: SectionInput[],
    onJobDone: (index: number, musicXmlUri: string) => Promise<void>,
  ) => void;
  reset: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMultiOmrJobs(): UseMultiOmrJobsResult {
  const [overallStatus, setOverallStatus] = useState<MultiJobStatus>("idle");
  const [jobs, setJobs] = useState<SectionJobState[]>([]);
  const [error, setError] = useState<string | null>(null);

  type Channel = ReturnType<NonNullable<typeof supabase>["channel"]>;
  const channelsRef = useRef<Channel[]>([]);

  const _unsubscribeAll = useCallback(() => {
    channelsRef.current.forEach((ch) => ch.unsubscribe());
    channelsRef.current = [];
  }, []);

  const _updateJob = useCallback(
    (index: number, patch: Partial<SectionJobState>) => {
      setJobs((prev) => prev.map((j, i) => (i === index ? { ...j, ...patch } : j)));
    },
    [],
  );

  const _checkAllSettled = useCallback(
    (updatedJobs: SectionJobState[]) => {
      const allSettled = updatedJobs.every(
        (j) => j.status === "done" || j.status === "failed",
      );
      if (!allSettled) return;
      const anyFailed = updatedJobs.some((j) => j.status === "failed");
      setOverallStatus(anyFailed ? "failed" : "done");
    },
    [],
  );

  const _pollJob = useCallback(
    (
      jobId: string,
      index: number,
      sheetId: string,
      onJobDone: (index: number, musicXmlUri: string) => Promise<void>,
    ) => {
      if (!supabase) return;

      const intervalId = setInterval(async () => {
        try {
          const { data } = await supabase
            .from("omr_jobs")
            .select("status, result_storage_path, error")
            .eq("id", jobId)
            .single();

          if (!data) return;
          const status = data.status as string;
          console.log(`[useMultiOmrJobs] job ${index} polled status: ${status}`);

          if (status === "processing") {
            _updateJob(index, { status: "processing" });
          } else if (status === "done") {
            clearInterval(intervalId);
            const resultPath = data.result_storage_path as string;
            try {
              const uri = await downloadResult(resultPath, sheetId);
              _updateJob(index, { status: "done", musicXmlUri: uri });
              await onJobDone(index, uri);
              setJobs((current) => {
                _checkAllSettled(current.map((j, i) =>
                  i === index ? { ...j, status: "done" as const, musicXmlUri: uri } : j,
                ));
                return current;
              });
            } catch (err) {
              clearInterval(intervalId);
              const error = err instanceof Error ? err.message : "Download failed";
              console.error(`[useMultiOmrJobs] job ${index} download failed:`, err);
              _updateJob(index, { status: "failed", error });
              setJobs((current) => {
                _checkAllSettled(current.map((j, i) =>
                  i === index ? { ...j, status: "failed" as const, error } : j,
                ));
                return current;
              });
            }
          } else if (status === "failed") {
            clearInterval(intervalId);
            const error = (data.error as string | null) ?? "OMR processing failed";
            _updateJob(index, { status: "failed", error });
            setJobs((current) => {
              _checkAllSettled(current.map((j, i) =>
                i === index ? { ...j, status: "failed" as const, error } : j,
              ));
              return current;
            });
          }
        } catch (err) {
          console.error(`[useMultiOmrJobs] job ${index} poll error:`, err);
        }
      }, 3000);

      channelsRef.current.push({ unsubscribe: () => clearInterval(intervalId) } as unknown as Channel);
    },
    [_updateJob, _checkAllSettled],
  );

  const submitAll = useCallback(
    (
      pdfB64: string,
      sections: SectionInput[],
      onJobDone: (index: number, musicXmlUri: string) => Promise<void>,
    ) => {
      setOverallStatus("uploading");
      setJobs(sections.map((s) => ({ title: s.title, status: "pending" })));

      (async () => {
        try {
          const tempId = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const storagePath = await uploadPdfToStorage(pdfB64, tempId);

          for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const sheetId = `section-${Date.now()}-${i}`;
            const jobId = await submitOmrJob(storagePath, [section.pageRange]);
            _updateJob(i, { status: "queued" });
            _pollJob(jobId, i, sheetId, onJobDone);
          }

          setOverallStatus("running");
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upload failed";
          console.error("[useMultiOmrJobs] submitAll failed:", err);
          setError(message);
          setJobs((prev) => prev.map((j) => ({ ...j, status: "failed" as const, error: message })));
          setOverallStatus("failed");
        }
      })();
    },
    [_updateJob, _pollJob],
  );

  const reset = useCallback(() => {
    _unsubscribeAll();
    setOverallStatus("idle");
    setJobs([]);
    setError(null);
  }, [_unsubscribeAll]);

  return { overallStatus, jobs, error, submitAll, reset };
}
