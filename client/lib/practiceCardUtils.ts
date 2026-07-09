import type { PracticeSession, SheetMusic } from "@/lib/storage";

export function getLastSession(
  sessions: PracticeSession[],
  sheetId: string
): PracticeSession | undefined {
  return sessions
    .filter((s) => s.sheetMusicId === sheetId)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
}

export function formatAccuracy(accuracy: number | undefined): string | null {
  if (accuracy === undefined) return null;
  return `${Math.round(accuracy * 100)}%`;
}

type OmrStatus = NonNullable<SheetMusic["omrStatus"]>;
type NonNoneStatus = Exclude<OmrStatus, "none">;

const STATUS_MAP: Record<NonNoneStatus, { label: string; variant: NonNoneStatus }> = {
  processing: { label: "Scanning\u2026", variant: "processing" },
  ready: { label: "Ready", variant: "ready" },
  failed: { label: "Failed", variant: "failed" },
};

export function omrStatusLabel(
  status: OmrStatus
): { label: string; variant: NonNoneStatus } | null {
  if (status === "none") return null;
  return STATUS_MAP[status];
}

/** "Jun 20" for this year, "Jun 20, 2025" for older imports. */
export function formatImportDate(createdAt: number, now: number = Date.now()): string {
  const date = new Date(createdAt);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
