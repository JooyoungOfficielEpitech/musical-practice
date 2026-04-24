/**
 * useMultiOmrJobs — orchestrates N parallel OMR jobs for a multi-section PDF import.
 *
 * Flow: upload PDF once → submit N jobs (one per section) → track via Supabase Realtime
 *       → call onJobDone(index, musicXmlUri) as each job completes.
 */
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { downloadResult, submitOmrJob, uploadPdfToStorage } from "@/lib/omrQueue";
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
  const pollsRef = useRef<ReturnType<typeof setInterval>[]>([]);

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

  const _checkAllSettled = useCallback(
    (updatedJobs: SectionJobState[]) => {
      const allSettled = updatedJobs.every(
        (j) => j.status === "done" || j.status === "failed",
      );
      if (!allSettled) return;
      setOverallStatus(updatedJobs.some((j) => j.status === "failed") ? "failed" : "done");
    },
    [],
  );

  const _subscribeJob = useCallback(
    (
      jobId: string,
      index: number,
      sheetId: string,
      onJobDone: (index: number, musicXmlUri: string) => Promise<void>,
    ) => {
      const sb = supabase;
      if (!sb) return;

      type JobRow = { status: string; progress_percent: number; result_storage_path: string | null; error: string | null };

      let settled = false;
      let pollInterval: ReturnType<typeof setInterval> | null = null;
      // channel declared early so handleRow closure can reference it
      let channel: ReturnType<NonNullable<typeof supabase>["channel"]>;

      const clearPoll = () => {
        if (pollInterval !== null) { clearInterval(pollInterval); pollInterval = null; }
      };

      const handleRow = async (row: JobRow) => {
        if (settled) return;
        if (row.status === "processing") {
          _updateJob(index, { status: "processing", progressPercent: row.progress_percent ?? 0, startedAt: Date.now() });
        } else if (row.status === "done") {
          settled = true;
          clearPoll();
          channel.unsubscribe();
          try {
            const uri = await downloadResult(row.result_storage_path as string, sheetId);
            _updateJob(index, { status: "done", progressPercent: 100, musicXmlUri: uri });
            await onJobDone(index, uri);
            setJobs((current) => {
              _checkAllSettled(current.map((j, i) =>
                i === index ? { ...j, status: "done" as const, progressPercent: 100, musicXmlUri: uri } : j,
              ));
              return current;
            });
          } catch (err) {
            const error = err instanceof Error ? err.message : "Download failed";
            _updateJob(index, { status: "failed", error });
            setJobs((current) => {
              _checkAllSettled(current.map((j, i) =>
                i === index ? { ...j, status: "failed" as const, error } : j,
              ));
              return current;
            });
          }
        } else if (row.status === "failed") {
          settled = true;
          clearPoll();
          channel.unsubscribe();
          const error = row.error ?? "OMR processing failed";
          _updateJob(index, { status: "failed", error });
          setJobs((current) => {
            _checkAllSettled(current.map((j, i) =>
              i === index ? { ...j, status: "failed" as const, error } : j,
            ));
            return current;
          });
        }
      };

      const pollJobState = async () => {
        if (settled) { clearPoll(); return; }
        const { data } = await sb.from("omr_jobs").select("status, progress_percent, result_storage_path, error").eq("id", jobId).single();
        if (data) await handleRow(data as JobRow);
      };

      channel = sb
        .channel(`omr_job_${jobId}_${index}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "omr_jobs", filter: `id=eq.${jobId}` },
          async (payload) => {
            console.log(`[Realtime] job ${jobId} UPDATE:`, payload.new);
            await handleRow(payload.new as JobRow);
          },
        )
        .subscribe(async (status, err) => {
          console.log(`[Realtime] job ${jobId} status:`, status, err ?? "");
          if (status === "SUBSCRIBED") {
            // Immediate catchup + polling fallback (guards against Realtime delivery gaps)
            await pollJobState();
          } else if (status === "TIMED_OUT" || status === "CLOSED" || status === "CHANNEL_ERROR") {
            // Realtime unavailable — fall through to polling-only mode
            console.log(`[Realtime] job ${jobId} falling back to poll-only`);
            await pollJobState();
          } else {
            return;
          }
          if (!settled && pollInterval === null) {
            pollInterval = setInterval(pollJobState, 3000);
            pollsRef.current.push(pollInterval);
          }
        });

      channelsRef.current.push(channel);
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
      setJobs(sections.map((s) => ({
        title: s.title, status: "pending", pageRange: s.pageRange ?? null, progressPercent: 0,
      })));

      (async () => {
        try {
          const tempId = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const storagePath = await uploadPdfToStorage(pdfB64, tempId);

          for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const sheetId = `section-${Date.now()}-${i}`;
            const jobId = await submitOmrJob(storagePath, section.pageRange ? [section.pageRange] : []);
            _updateJob(i, { status: "queued" });
            _subscribeJob(jobId, i, sheetId, onJobDone);
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
    [_updateJob, _subscribeJob],
  );

  const reset = useCallback(() => {
    _unsubscribeAll();
    setOverallStatus("idle");
    setJobs([]);
    setError(null);
  }, [_unsubscribeAll]);

  return { overallStatus, jobs, error, submitAll, reset };
}
