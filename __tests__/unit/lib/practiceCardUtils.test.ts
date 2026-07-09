import {
  getLastSession,
  formatAccuracy,
  omrStatusLabel,
} from "../../../client/lib/practiceCardUtils";
import type { PracticeSession } from "../../../client/lib/storage";

function makeSession(overrides: Partial<PracticeSession> = {}): PracticeSession {
  return {
    id: "sess-1",
    sheetMusicId: "s1",
    sheetMusicTitle: "Test Song",
    startedAt: 1000,
    duration: 600,
    accuracy: 0.8,
    bpm: 120,
    ...overrides,
  };
}

describe("getLastSession", () => {
  it("returns the session with the latest startedAt for a given sheetId", () => {
    const sessions = [
      makeSession({ id: "a", sheetMusicId: "s1", startedAt: 1000, accuracy: 0.7 }),
      makeSession({ id: "b", sheetMusicId: "s1", startedAt: 2000, accuracy: 0.9 }),
    ];
    const result = getLastSession(sessions, "s1");
    expect(result).toBeDefined();
    expect(result?.startedAt).toBe(2000);
    expect(result?.accuracy).toBe(0.9);
  });

  it("returns undefined when no sessions match the sheetId", () => {
    const sessions = [
      makeSession({ sheetMusicId: "s2", startedAt: 1000 }),
    ];
    const result = getLastSession(sessions, "s1");
    expect(result).toBeUndefined();
  });
});

describe("formatAccuracy", () => {
  it("converts 0–1 float to a percentage string", () => {
    expect(formatAccuracy(0.87)).toBe("87%");
    expect(formatAccuracy(1)).toBe("100%");
    expect(formatAccuracy(0)).toBe("0%");
  });

  it("returns null for undefined input", () => {
    expect(formatAccuracy(undefined)).toBeNull();
  });
});

describe("omrStatusLabel", () => {
  it("returns correct label and variant for each non-none status", () => {
    expect(omrStatusLabel("processing")).toEqual({ label: "Scanning…", variant: "processing" });
    expect(omrStatusLabel("ready")).toEqual({ label: "Ready", variant: "ready" });
    expect(omrStatusLabel("failed")).toEqual({ label: "Failed", variant: "failed" });
  });

  it("returns null for status 'none'", () => {
    expect(omrStatusLabel("none")).toBeNull();
  });
});

describe("formatImportDate", () => {
  const { formatImportDate } = require("../../../client/lib/practiceCardUtils");

  it("omits the year for dates in the current year", () => {
    const now = new Date("2026-07-09T12:00:00Z").getTime();
    const jun20 = new Date("2026-06-20T12:00:00Z").getTime();
    expect(formatImportDate(jun20, now)).toMatch(/^Jun 20$/);
  });

  it("includes the year for older imports", () => {
    const now = new Date("2026-07-09T12:00:00Z").getTime();
    const lastYear = new Date("2025-06-20T12:00:00Z").getTime();
    expect(formatImportDate(lastYear, now)).toMatch(/^Jun 20, 2025$/);
  });
});
