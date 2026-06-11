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
 * Backoff calculation for polling (simple: fixed interval for now).
 * Could be extended to exponential backoff later.
 */
export const POLL_INTERVAL_MS = 1000;

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
