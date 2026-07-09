import AsyncStorage from "@react-native-async-storage/async-storage";
import { migrateSheetMusic } from "./migration";

export interface SheetMusic {
  id: string;
  title: string;
  artist: string;
  imageUris: string[];
  audioUri?: string;
  createdAt: number;
  folder: string;
  isFavorite: boolean;
  musicXmlUri?: string;
  noteSequenceUri?: string;
  /** Supabase storage path of the OMR result — lets the app re-pull the latest
   *  server-side result (reprocessed scores) instead of serving a stale cache. */
  resultStoragePath?: string;
  omrStatus?: "none" | "processing" | "ready" | "failed";
  /** omr_jobs row ID — lets the app reconcile a still-processing sheet after
   *  the import screen is gone (app killed, user navigated away). */
  omrJobId?: string;
  selectedInstrument?: string;
  selectedPartIds?: string[]; // parts the user chose to practice (성부 선택), persisted
  /** Last tempo multiplier the user set for this score — restored on open. */
  savedTempoMultiplier?: number;
}

export interface PracticeSession {
  id: string;
  sheetMusicId: string;
  sheetMusicTitle: string;
  startedAt: number;
  duration: number;
  accuracy: number;
  bpm: number;
  recordingUri?: string;
  pitchData?: {
    totalReadings: number;
    correctReadings: number;
  };
}

export interface UserStats {
  totalPracticeTime: number;
  totalSessions: number;
  averageAccuracy: number;
  streak: number;
  lastPracticeDate: string;
}

const KEYS = {
  SHEETS: "@musicalpractice/sheets",
  SESSIONS: "@musicalpractice/sessions",
  STATS: "@musicalpractice/stats",
  SETTINGS: "@musicalpractice/settings",
};

export async function getSheets(): Promise<SheetMusic[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.SHEETS);
    if (!data) return [];
    const raw: any[] = JSON.parse(data);
    return raw.map(migrateSheetMusic);
  } catch {
    return [];
  }
}

export async function saveSheet(sheet: SheetMusic): Promise<void> {
  try {
    const sheets = await getSheets();
    sheets.unshift(sheet);
    await AsyncStorage.setItem(KEYS.SHEETS, JSON.stringify(sheets));
  } catch (e) {
    console.error("Failed to save sheet:", e);
  }
}

export async function updateSheet(updated: SheetMusic): Promise<void> {
  try {
    const sheets = await getSheets();
    const idx = sheets.findIndex((s) => s.id === updated.id);
    if (idx !== -1) {
      sheets[idx] = updated;
      await AsyncStorage.setItem(KEYS.SHEETS, JSON.stringify(sheets));
    }
  } catch (e) {
    console.error("Failed to update sheet:", e);
  }
}

/**
 * Merge a partial patch into one stored sheet.
 * Returns the patched sheet, or null when the id is unknown.
 */
export async function patchSheet(
  id: string,
  patch: Partial<SheetMusic>,
): Promise<SheetMusic | null> {
  try {
    const sheets = await getSheets();
    const idx = sheets.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    const patched = { ...sheets[idx], ...patch };
    const next = sheets.map((s, i) => (i === idx ? patched : s));
    await AsyncStorage.setItem(KEYS.SHEETS, JSON.stringify(next));
    return patched;
  } catch (e) {
    console.error("Failed to patch sheet:", e);
    return null;
  }
}

export async function deleteSheet(id: string): Promise<void> {
  try {
    const sheets = await getSheets();
    const filtered = sheets.filter((s) => s.id !== id);
    await AsyncStorage.setItem(KEYS.SHEETS, JSON.stringify(filtered));
  } catch (e) {
    console.error("Failed to delete sheet:", e);
  }
}

export async function getSessions(): Promise<PracticeSession[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.SESSIONS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveSession(session: PracticeSession): Promise<void> {
  try {
    const sessions = await getSessions();
    sessions.unshift(session);
    await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
  } catch (e) {
    console.error("Failed to save session:", e);
  }
}

export async function getStats(): Promise<UserStats> {
  try {
    const data = await AsyncStorage.getItem(KEYS.STATS);
    return data
      ? JSON.parse(data)
      : {
          totalPracticeTime: 0,
          totalSessions: 0,
          averageAccuracy: 0,
          streak: 0,
          lastPracticeDate: "",
        };
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

export async function updateStats(stats: UserStats): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.STATS, JSON.stringify(stats));
  } catch (e) {
    console.error("Failed to update stats:", e);
  }
}

export function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}
