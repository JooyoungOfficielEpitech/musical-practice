/**
 * Realtime + polling subscription for a single OMR job row.
 *
 * Extracted from useMultiOmrJobs: tracks one omr_jobs row via Supabase
 * Realtime with a polling fallback, downloads the result when done, and
 * reports state changes back through the deps callbacks.
 */
import { AccessibilityInfo } from "react-native";
import { supabase } from "@/lib/supabase";
import { downloadResult } from "@/lib/omrQueue";
import { isRealtimeFatalStatus, POLL_INTERVAL_MS } from "@/lib/omrJobPolling";
import type { SectionJobState } from "@/hooks/useMultiOmrJobs";

type JobRow = {
  status: string;
  progress_percent: number;
  result_storage_path: string | null;
  error: string | null;
};

export interface JobSubscriptionDeps {
  /** Patch one job's state without settlement bookkeeping. */
  updateJob: (index: number, patch: Partial<SectionJobState>) => void;
  /** Patch one job's state AND re-evaluate overall settlement. */
  settleJob: (index: number, patch: Partial<SectionJobState>) => void;
  /** Display title for accessibility announcements. */
  sectionTitle: (index: number) => string;
  registerChannel: (channel: { unsubscribe: () => void }) => void;
  registerPoll: (id: ReturnType<typeof setInterval>) => void;
}

export function subscribeOmrJob(
  jobId: string,
  index: number,
  sheetId: string,
  onJobDone: (index: number, musicXmlUri: string, resultStoragePath: string) => Promise<void>,
  deps: JobSubscriptionDeps,
): void {
  const sb = supabase;
  if (!sb) return;

  let settled = false;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let channel: ReturnType<NonNullable<typeof supabase>["channel"]>;

  const clearPoll = () => {
    if (pollInterval !== null) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };

  const settle = (patch: Partial<SectionJobState>, announcement: string) => {
    settled = true;
    clearPoll();
    channel.unsubscribe();
    deps.settleJob(index, patch);
    AccessibilityInfo.announceForAccessibility(announcement);
  };

  const handleRow = async (row: JobRow) => {
    if (settled) return;
    if (row.status === "processing") {
      deps.updateJob(index, {
        status: "processing",
        progressPercent: row.progress_percent ?? 0,
        startedAt: Date.now(),
      });
    } else if (row.status === "done") {
      settled = true;
      clearPoll();
      channel.unsubscribe();
      try {
        const storagePath = row.result_storage_path as string;
        const uri = await downloadResult(storagePath, sheetId);
        deps.updateJob(index, { status: "done", progressPercent: 100, musicXmlUri: uri });
        // Persist the sheet BEFORE settlement so overall "done" never precedes the saved result
        await onJobDone(index, uri, storagePath);
        deps.settleJob(index, { status: "done", progressPercent: 100, musicXmlUri: uri });
        AccessibilityInfo.announceForAccessibility(
          `Recognition complete for ${deps.sectionTitle(index)}`,
        );
      } catch (err) {
        // Distinguish download vs file-write errors for better user messaging
        const errorMsg = err instanceof Error ? err.message : "Download failed";
        const error = errorMsg.includes("Failed to read") || errorMsg.includes("Failed to write")
          ? `File write failed: ${errorMsg}`
          : `Network: ${errorMsg}`;
        deps.settleJob(index, { status: "failed", error });
        AccessibilityInfo.announceForAccessibility(
          `Recognition failed for ${deps.sectionTitle(index)}: ${error}`,
        );
      }
    } else if (row.status === "failed") {
      const error = row.error ?? "OMR processing failed";
      settle(
        { status: "failed", error },
        `Recognition failed for ${deps.sectionTitle(index)}: ${error}`,
      );
    }
  };

  const pollJobState = async () => {
    if (settled) {
      clearPoll();
      return;
    }
    const { data } = await sb
      .from("omr_jobs")
      .select("status, progress_percent, result_storage_path, error")
      .eq("id", jobId)
      .single();
    if (data) await handleRow(data as JobRow);
  };

  if (__DEV__) {
    console.log(`[Realtime] subscribing to job ${jobId} at index ${index}`);
  }

  channel = sb
    .channel(`omr_job_${jobId}_${index}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "omr_jobs", filter: `id=eq.${jobId}` },
      async (payload) => {
        if (__DEV__) {
          console.log(`[Realtime] job ${jobId} UPDATE:`, payload.new);
        }
        await handleRow(payload.new as JobRow);
      },
    )
    .subscribe(async (status, err) => {
      if (__DEV__) {
        console.log(`[Realtime] job ${jobId} status:`, status, err ?? "");
      }
      if (status === "SUBSCRIBED") {
        // Immediate catchup + polling fallback (guards against Realtime delivery gaps)
        await pollJobState();
      } else if (isRealtimeFatalStatus(status)) {
        if (__DEV__) {
          console.log(`[Realtime] job ${jobId} falling back to poll-only`);
        }
        await pollJobState();
      } else {
        return;
      }
      if (!settled && pollInterval === null) {
        pollInterval = setInterval(pollJobState, POLL_INTERVAL_MS);
        deps.registerPoll(pollInterval);
      }
    });

  deps.registerChannel(channel);
}
