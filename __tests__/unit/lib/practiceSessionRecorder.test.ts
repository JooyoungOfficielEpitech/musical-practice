/**
 * Tests for practiceSessionRecorder.ts
 * TDD approach: RED → GREEN → REFACTOR
 */

import * as storage from "../../../client/lib/storage";
import {
  recordSession,
  getLibraryStats,
  MIN_SESSION_SEC,
} from "../../../client/lib/practiceSessionRecorder";

// Mock storage functions
jest.mock("../../../client/lib/storage");

// Mock streakCalculation
jest.mock("../../../client/lib/streakCalculation", () => ({
  calculateStreak: jest.fn((sessions: any[], lastStats: any) => {
    // Simple mock: extend streak if practiced yesterday, else reset to 1
    if (sessions.length === 0) return 1;
    const today = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    return lastStats?.lastPracticeDate === yesterdayStr ? (lastStats?.streak ?? 0) + 1 : 1;
  }),
}));

describe("practiceSessionRecorder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date("2024-03-15T10:00:00Z") });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("recordSession", () => {
    it("should reject sessions shorter than MIN_SESSION_SEC", async () => {
      (storage.saveSession as jest.Mock).mockResolvedValue(undefined);
      (storage.getStats as jest.Mock).mockResolvedValue({
        totalPracticeTime: 0,
        totalSessions: 0,
        averageAccuracy: 0,
        streak: 0,
        lastPracticeDate: "",
      });

      const result = await recordSession({
        sheetId: "sheet-1",
        sheetTitle: "Test Song",
        durationSec: 10, // Less than MIN_SESSION_SEC
      });

      expect(result).toBeNull();
      expect(storage.saveSession).not.toHaveBeenCalled();
    });

    it("should accept sessions at exactly MIN_SESSION_SEC", async () => {
      (storage.generateId as jest.Mock).mockReturnValue("session-123");
      (storage.saveSession as jest.Mock).mockResolvedValue(undefined);
      (storage.getSessions as jest.Mock).mockResolvedValue([]);
      (storage.getStats as jest.Mock).mockResolvedValue({
        totalPracticeTime: 0,
        totalSessions: 0,
        averageAccuracy: 0,
        streak: 0,
        lastPracticeDate: "",
      });
      (storage.updateStats as jest.Mock).mockResolvedValue(undefined);

      const result = await recordSession({
        sheetId: "sheet-1",
        sheetTitle: "Test Song",
        durationSec: MIN_SESSION_SEC,
      });

      expect(result).not.toBeNull();
      expect(storage.saveSession).toHaveBeenCalled();
    });

    it("should create a PracticeSession with required fields", async () => {
      (storage.generateId as jest.Mock).mockReturnValue("session-123");
      (storage.saveSession as jest.Mock).mockResolvedValue(undefined);
      (storage.getSessions as jest.Mock).mockResolvedValue([]);
      (storage.getStats as jest.Mock).mockResolvedValue({
        totalPracticeTime: 0,
        totalSessions: 0,
        averageAccuracy: 0,
        streak: 0,
        lastPracticeDate: "",
      });
      (storage.updateStats as jest.Mock).mockResolvedValue(undefined);

      const result = await recordSession({
        sheetId: "sheet-1",
        sheetTitle: "Test Song",
        durationSec: 120,
        accuracy: 85,
        bpm: 120,
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: "session-123",
          sheetMusicId: "sheet-1",
          sheetMusicTitle: "Test Song",
          duration: 120,
          accuracy: 85,
          bpm: 120,
          startedAt: expect.any(Number),
        }),
      );
    });

    it("should save the session via storage.saveSession", async () => {
      (storage.generateId as jest.Mock).mockReturnValue("session-123");
      (storage.saveSession as jest.Mock).mockResolvedValue(undefined);
      (storage.getSessions as jest.Mock).mockResolvedValue([]);
      (storage.getStats as jest.Mock).mockResolvedValue({
        totalPracticeTime: 0,
        totalSessions: 0,
        averageAccuracy: 0,
        streak: 0,
        lastPracticeDate: "",
      });
      (storage.updateStats as jest.Mock).mockResolvedValue(undefined);

      await recordSession({
        sheetId: "sheet-1",
        sheetTitle: "Test Song",
        durationSec: 120,
      });

      expect(storage.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "session-123",
          sheetMusicId: "sheet-1",
          sheetMusicTitle: "Test Song",
          duration: 120,
        }),
      );
    });

    it("should update stats with recomputed totalPracticeTime", async () => {
      (storage.generateId as jest.Mock).mockReturnValue("session-123");
      (storage.saveSession as jest.Mock).mockResolvedValue(undefined);
      // getSessions returns the full list AFTER saveSession (includes new session)
      (storage.getSessions as jest.Mock).mockResolvedValue([
        {
          id: "session-123",
          sheetMusicId: "sheet-2",
          sheetMusicTitle: "Song 2",
          duration: 180,
          accuracy: 90,
          bpm: 100,
          startedAt: 1704067200000,
        },
        {
          id: "session-1",
          sheetMusicId: "sheet-1",
          sheetMusicTitle: "Song 1",
          duration: 300,
          accuracy: 80,
          bpm: 120,
          startedAt: 1000,
        },
      ]);
      (storage.getStats as jest.Mock).mockResolvedValue({
        totalPracticeTime: 300,
        totalSessions: 1,
        averageAccuracy: 80,
        streak: 1,
        lastPracticeDate: new Date().toDateString(),
      });
      (storage.updateStats as jest.Mock).mockResolvedValue(undefined);

      await recordSession({
        sheetId: "sheet-2",
        sheetTitle: "Song 2",
        durationSec: 180,
        accuracy: 90,
      });

      expect(storage.updateStats).toHaveBeenCalledWith(
        expect.objectContaining({
          totalPracticeTime: 480, // 300 + 180
          totalSessions: 2,
        }),
      );
    });

    it("should compute streak correctly using streakCalculation", async () => {
      (storage.generateId as jest.Mock).mockReturnValue("session-123");
      (storage.saveSession as jest.Mock).mockResolvedValue(undefined);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      (storage.getSessions as jest.Mock).mockResolvedValue([]);
      (storage.getStats as jest.Mock).mockResolvedValue({
        totalPracticeTime: 100,
        totalSessions: 1,
        averageAccuracy: 80,
        streak: 1,
        lastPracticeDate: yesterday.toDateString(),
      });
      (storage.updateStats as jest.Mock).mockResolvedValue(undefined);

      await recordSession({
        sheetId: "sheet-1",
        sheetTitle: "Song",
        durationSec: 60,
      });

      const updateCall = (storage.updateStats as jest.Mock).mock.calls[0][0];
      expect(updateCall.streak).toBeGreaterThanOrEqual(1);
    });

    it("should update lastPracticeDate to today", async () => {
      (storage.generateId as jest.Mock).mockReturnValue("session-123");
      (storage.saveSession as jest.Mock).mockResolvedValue(undefined);
      (storage.getSessions as jest.Mock).mockResolvedValue([]);
      (storage.getStats as jest.Mock).mockResolvedValue({
        totalPracticeTime: 0,
        totalSessions: 0,
        averageAccuracy: 0,
        streak: 0,
        lastPracticeDate: "",
      });
      (storage.updateStats as jest.Mock).mockResolvedValue(undefined);

      await recordSession({
        sheetId: "sheet-1",
        sheetTitle: "Song",
        durationSec: 60,
      });

      const today = new Date().toDateString();
      expect(storage.updateStats).toHaveBeenCalledWith(
        expect.objectContaining({
          lastPracticeDate: today,
        }),
      );
    });

    it("should handle optional accuracy and bpm", async () => {
      (storage.generateId as jest.Mock).mockReturnValue("session-123");
      (storage.saveSession as jest.Mock).mockResolvedValue(undefined);
      (storage.getSessions as jest.Mock).mockResolvedValue([]);
      (storage.getStats as jest.Mock).mockResolvedValue({
        totalPracticeTime: 0,
        totalSessions: 0,
        averageAccuracy: 0,
        streak: 0,
        lastPracticeDate: "",
      });
      (storage.updateStats as jest.Mock).mockResolvedValue(undefined);

      const result = await recordSession({
        sheetId: "sheet-1",
        sheetTitle: "Song",
        durationSec: 60,
        // accuracy and bpm omitted
      });

      expect(result).toEqual(
        expect.objectContaining({
          accuracy: expect.any(Number),
          bpm: expect.any(Number),
        }),
      );
    });
  });

  describe("getLibraryStats", () => {
    it("should return stats from storage with safe defaults", async () => {
      (storage.getStats as jest.Mock).mockResolvedValue({
        totalPracticeTime: 3600,
        totalSessions: 10,
        averageAccuracy: 85,
        streak: 5,
        lastPracticeDate: "Fri Mar 15 2024",
      });

      const stats = await getLibraryStats();

      expect(stats).toEqual({
        totalPracticeTime: 3600,
        totalSessions: 10,
        averageAccuracy: 85,
        streak: 5,
        lastPracticeDate: "Fri Mar 15 2024",
      });
    });

    it("should return safe defaults when storage returns undefined", async () => {
      (storage.getStats as jest.Mock).mockResolvedValue({
        totalPracticeTime: 0,
        totalSessions: 0,
        averageAccuracy: 0,
        streak: 0,
        lastPracticeDate: "",
      });

      const stats = await getLibraryStats();

      expect(stats.totalPracticeTime).toBe(0);
      expect(stats.totalSessions).toBe(0);
      expect(stats.streak).toBe(0);
    });

    it("should not throw on storage errors", async () => {
      (storage.getStats as jest.Mock).mockRejectedValue(new Error("Storage error"));

      const stats = await getLibraryStats();

      expect(stats).toEqual({
        totalPracticeTime: 0,
        totalSessions: 0,
        averageAccuracy: 0,
        streak: 0,
        lastPracticeDate: "",
      });
    });
  });

  describe("MIN_SESSION_SEC constant", () => {
    it("should be defined and positive", () => {
      expect(MIN_SESSION_SEC).toBeGreaterThan(0);
    });

    it("should be at least 30 seconds", () => {
      expect(MIN_SESSION_SEC).toBeGreaterThanOrEqual(30);
    });
  });
});
