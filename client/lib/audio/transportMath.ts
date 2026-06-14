import type { LoopRange } from "@/hooks/useSynthPlayer";

/** Convert a 0..1 track ratio to a clamped millisecond position. */
export function ratioToMs(ratio: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  const clamped = Math.max(0, Math.min(1, ratio));
  return Math.round(clamped * durationMs);
}

/** Convert a millisecond position to a 0..1 track ratio. */
export function msToRatio(ms: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return Math.max(0, Math.min(1, ms / durationMs));
}

/** Convert a gesture x (px) within a track of width (px) to a ms position. */
export function gestureXToMs(x: number, trackWidth: number, durationMs: number): number {
  if (trackWidth <= 0) return 0;
  return ratioToMs(x / trackWidth, durationMs);
}

/**
 * Build a valid loop range from two captured points (order-independent), or
 * null if they don't form a usable range. Bounds are clamped to [0, durationMs]
 * and the two points must be at least minLenMs apart.
 */
export function makeLoopRange(
  aMs: number | null,
  bMs: number | null,
  durationMs: number,
  minLenMs: number = 200,
): LoopRange | null {
  if (aMs === null || bMs === null || durationMs <= 0) return null;
  const lo = Math.max(0, Math.min(aMs, bMs));
  const hi = Math.min(durationMs, Math.max(aMs, bMs));
  if (hi - lo < minLenMs) return null;
  return { startMs: Math.round(lo), endMs: Math.round(hi) };
}
