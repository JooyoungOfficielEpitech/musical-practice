/**
 * useOmrJob — orchestrates the full Supabase queue round-trip for OMR processing.
 *
 * State machine:
 *   idle → submitting → queued → processing → done | failed
 *
 * The hook uploads the PDF, inserts a job row, subscribes to Realtime updates
 * on that row, and transitions state as the server processes the job.
 */
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  OmrQueueError,
  downloadResult,
  submitOmrJob,
  uploadPdfToStorage,
} from "@/lib/omrQueue";
import type { PageRange } from "@/lib/pdfImport";

// ─── Types ──────────────────────────────────────────────────────────────────

export type OmrJobState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "queued"; jobId: string }
  | { status: "processing"; jobId: string }
  | { status: "done"; musicXmlUri: string }
  | { status: "failed"; error: string };

export interface UseOmrJobResult {
  state: OmrJobState;
  submitJob: (pdfB64: string, pageRanges: PageRange[], sheetId: string) => void;
  reset: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useOmrJob(): UseOmrJobResult {
  const [state, setState] = useState<OmrJobState>({ status: "idle" });
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);

  const _unsubscribe = useCallback(() => {
    channelRef.current?.unsubscribe();
    channelRef.current = null;
  }, []);

  const _subscribeToJob = useCallback(
    (jobId: string, sheetId: string) => {
      if (!supabase) return;

      const channel = (supabase.channel(`omr_job_${jobId}`) as any)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "omr_jobs",
            filter: `id=eq.${jobId}`,
          },
          async (payload: { new: Record<string, unknown> }) => {
            const row = payload.new;
            const status = row["status"] as string;

            if (status === "processing") {
              setState({ status: "processing", jobId });
            } else if (status === "done") {
              const resultPath = row["result_storage_path"] as string;
              try {
                const uri = await downloadResult(resultPath, sheetId);
                _unsubscribe();
                setState({ status: "done", musicXmlUri: uri });
              } catch (err) {
                _unsubscribe();
                setState({
                  status: "failed",
                  error: err instanceof Error ? err.message : "Download failed",
                });
              }
            } else if (status === "failed") {
              _unsubscribe();
              setState({
                status: "failed",
                error: (row["error"] as string | null) ?? "OMR processing failed",
              });
            }
          },
        )
        .subscribe();

      channelRef.current = channel as any;
    },
    [_unsubscribe],
  );

  const submitJob = useCallback(
    (pdfB64: string, pageRanges: PageRange[], sheetId: string) => {
      setState({ status: "submitting" });

      (async () => {
        try {
          // Generate a temporary client-side ID for the storage path
          const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const storagePath = await uploadPdfToStorage(pdfB64, tempId);
          const jobId = await submitOmrJob(storagePath, pageRanges);
          setState({ status: "queued", jobId });
          _subscribeToJob(jobId, sheetId);
        } catch (err) {
          setState({
            status: "failed",
            error: err instanceof OmrQueueError
              ? err.message
              : err instanceof Error
              ? err.message
              : "Submission failed",
          });
        }
      })();
    },
    [_subscribeToJob],
  );

  const reset = useCallback(() => {
    _unsubscribe();
    setState({ status: "idle" });
  }, [_unsubscribe]);

  return { state, submitJob, reset };
}
