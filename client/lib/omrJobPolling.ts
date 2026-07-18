/**
 * Pure helpers for OMR job status tracking and polling logic.
 */
import type { SectionJobState } from "@/hooks/useMultiOmrJobs";

/**
 * Check if all jobs have settled (either done or failed).
 */
export function checkAllSettled(jobs: SectionJobState[]): {
  allSettled: boolean;
  shouldBeDone: boolean;
} {
  const allSettled = jobs.every((j) => j.status === "done" || j.status === "failed");
  const shouldBeDone = jobs.some((j) => j.status === "failed") ? false : true;

  return { allSettled, shouldBeDone };
}

/**
 * Fallback poll cadence when Realtime misses events. Realtime is the primary
 * signal — 2.5s keeps catch-up latency low without hammering PostgREST.
 */
export const POLL_INTERVAL_MS = 2500;

/**
 * Determine if Realtime has given us a fatal condition.
 */
export function isRealtimeFatalStatus(status: string): boolean {
  return (
    status === "TIMED_OUT" ||
    status === "CLOSED" ||
    status === "CHANNEL_ERROR"
  );
}
