/**
 * TEMPORARY in-app debug instrumentation for tracking sync/timing bugs.
 * Everything is gated on DEBUG_TOOLS_ENABLED — flip to false (or delete the
 * debug/ folder + DebugOverlay usages) to strip it out after the hunt.
 */

export const DEBUG_TOOLS_ENABLED = true;

export interface DebugEntry {
  t: number; // epoch ms
  tag: string;
  msg: string;
}

const MAX_ENTRIES = 300;
const entries: DebugEntry[] = [];
const listeners = new Set<() => void>();

/** Append a log entry (no-op when disabled). Data is stringified inline. */
export function dlog(tag: string, msg: string, data?: Record<string, unknown>): void {
  if (!DEBUG_TOOLS_ENABLED) return;
  const suffix = data
    ? " " +
      Object.entries(data)
        .map(([k, v]) => `${k}=${typeof v === "number" ? +v.toFixed?.(3) || v : String(v)}`)
        .join(" ")
    : "";
  entries.push({ t: Date.now(), tag, msg: msg + suffix });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  listeners.forEach((fn) => fn());
}

export function getDebugEntries(): readonly DebugEntry[] {
  return entries;
}

export function clearDebugLog(): void {
  entries.length = 0;
  listeners.forEach((fn) => fn());
}

export function subscribeDebugLog(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Full formatted dump for copy-paste into a bug report. */
export function dumpDebugLog(header?: Record<string, unknown>): string {
  const head = header
    ? Object.entries(header)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join("\n")
    : "";
  const body = entries
    .map((e) => `${new Date(e.t).toISOString().slice(11, 23)} [${e.tag}] ${e.msg}`)
    .join("\n");
  return `=== DEBUG DUMP ${new Date().toISOString()} ===\n${head}\n--- events ---\n${body}`;
}
