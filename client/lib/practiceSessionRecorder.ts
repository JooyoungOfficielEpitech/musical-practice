/**
 * Practice session recording and stats orchestration.
 * Orchestrates creating sessions, saving them, and recomputing user stats.
 */

import { PracticeSession, UserStats } from "./storage";
import * as storage from "./storage";
import { calculateStreak } from "./streakCalculation";

export const MIN_SESSION_SEC = 30;

/**
 * Records a practice session and updates stats.
 * Sessions shorter than MIN_SESSION_SEC are rejected (return null).
 *
 * @param params Session parameters
 * @returns The created PracticeSession, or null if rejected (too short)
 */
export async function recordSession({
  sheetId,
  sheetTitle,
  durationSec,
  accuracy,
  bpm,
  recordingUri,
}: {
  sheetId: string;
  sheetTitle: string;
  durationSec: number;
  accuracy?: number;
  bpm?: number;
  recordingUri?: string;
}): Promise<PracticeSession | null> {
  // Reject sessions shorter than 30 seconds
  if (durationSec < MIN_SESSION_SEC) {
    return null;
  }

  const sessionId = storage.generateId();
  const session: PracticeSession = {
    id: sessionId,
    sheetMusicId: sheetId,
    sheetMusicTitle: sheetTitle,
    startedAt: Date.now(),
    duration: durationSec,
    // Canonical unit: 0..1 fraction (the card chip and toast multiply by 100).
    accuracy: accuracy !== undefined ? Math.max(0, Math.min(1, accuracy)) : 0,
    bpm: bpm ?? 100,
    recordingUri,
  };

  // Save the session
  await storage.saveSession(session);

  // Recompute stats
  const sessions = await storage.getSessions();
  const prevStats = await storage.getStats();

  // Total practice time: sum all session durations
  const totalPracticeTime = sessions.reduce((sum, s) => sum + s.duration, 0);

  // Total sessions count
  const totalSessions = sessions.length;

  // Average accuracy across all sessions
  const totalAccuracy = sessions.reduce((sum, s) => sum + s.accuracy, 0);
  const averageAccuracy = totalSessions > 0 ? totalAccuracy / totalSessions : 0;

  // Streak calculation using streakCalculation module
  const streak = calculateStreak(sessions, prevStats);

  // Last practice date is today (local timezone)
  const lastPracticeDate = new Date().toDateString();

  const updatedStats: UserStats = {
    totalPracticeTime,
    totalSessions,
    averageAccuracy,
    streak,
    lastPracticeDate,
  };

  await storage.updateStats(updatedStats);

  return session;
}

/**
 * Get current library stats with safe defaults.
 *
 * @returns Current UserStats, or defaults if storage unavailable
 */
export async function getLibraryStats(): Promise<UserStats> {
  try {
    const stats = await storage.getStats();
    return stats;
  } catch {
    return {
      totalPracticeTime: 0,
      totalSessions: 0,
      averageAccuracy: 0,
      streak: 0,
      lastPracticeDate: "",
    };
  }
}

/**
 * Latest recorded accuracy (0..1) per sheet — feeds the library card chip.
 * Sessions with no accuracy (0) are skipped; safe empty map on any failure.
 */
export async function getLastAccuracyBySheet(): Promise<Record<string, number>> {
  try {
    const sessions = await storage.getSessions();
    const latest: Record<string, { startedAt: number; accuracy: number }> = {};
    for (const s of sessions) {
      if (s.accuracy <= 0) continue;
      const prev = latest[s.sheetMusicId];
      if (!prev || s.startedAt >= prev.startedAt) {
        latest[s.sheetMusicId] = { startedAt: s.startedAt, accuracy: s.accuracy };
      }
    }
    const result: Record<string, number> = {};
    for (const [sheetId, entry] of Object.entries(latest)) {
      result[sheetId] = entry.accuracy;
    }
    return result;
  } catch {
    return {};
  }
}
