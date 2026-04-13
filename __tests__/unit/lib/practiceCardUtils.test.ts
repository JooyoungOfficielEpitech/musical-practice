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
