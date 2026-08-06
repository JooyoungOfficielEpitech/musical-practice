/**
 * Streak calculation with timezone-safe date handling.
 * Uses local-timezone date strings and setDate() to avoid UTC subtraction bugs.
 */

import type { PracticeSession, UserStats } from "./storage";

/**
 * Calculate the current practice streak.
 * Extends streak if last practice was yesterday, resets to 1 if gap > 1 day,
 * or maintains if practiced today.
 *
 * @param sessions All practice sessions (ordered newest first)
 * @param prevStats Previous stats (for current streak and lastPracticeDate)
 * @returns New streak count
 */
export function calculateStreak(sessions: PracticeSession[], prevStats: UserStats): number {
  if (sessions.length === 0) {
    return 1;
  }

  const today = new Date().toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  const lastPracticeDate = prevStats.lastPracticeDate;

  // If practiced today, streak stays the same
  if (lastPracticeDate === today) {
    return prevStats.streak;
  }

  // If practiced yesterday, extend the streak
  if (lastPracticeDate === yesterdayStr) {
    return prevStats.streak + 1;
  }

  // Gap > 1 day, reset to 1
  return 1;
}
