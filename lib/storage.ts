import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SheetMusic {
  id: string;
  title: string;
  artist: string;
  imageUri: string;
  createdAt: number;
  folder: string;
  bpm: number;
  key: string;
  isFavorite: boolean;
}

export interface PracticeSession {
  id: string;
  sheetMusicId: string;
  sheetMusicTitle: string;
  startedAt: number;
  duration: number;
  accuracy: number;
  bpm: number;
}

export interface UserStats {
  totalPracticeTime: number;
  totalSessions: number;
  averageAccuracy: number;
  streak: number;
  lastPracticeDate: string;
}

const KEYS = {
  SHEETS: "musical_practice_sheets",
  SESSIONS: "musical_practice_sessions",
  STATS: "musical_practice_stats",
  SETTINGS: "musical_practice_settings",
};

export async function getSheets(): Promise<SheetMusic[]> {
  const data = await AsyncStorage.getItem(KEYS.SHEETS);
  return data ? JSON.parse(data) : [];
}

export async function saveSheet(sheet: SheetMusic): Promise<void> {
  const sheets = await getSheets();
  sheets.unshift(sheet);
  await AsyncStorage.setItem(KEYS.SHEETS, JSON.stringify(sheets));
}

export async function updateSheet(updated: SheetMusic): Promise<void> {
  const sheets = await getSheets();
  const idx = sheets.findIndex((s) => s.id === updated.id);
  if (idx !== -1) {
    sheets[idx] = updated;
    await AsyncStorage.setItem(KEYS.SHEETS, JSON.stringify(sheets));
  }
}

export async function deleteSheet(id: string): Promise<void> {
  const sheets = await getSheets();
  const filtered = sheets.filter((s) => s.id !== id);
  await AsyncStorage.setItem(KEYS.SHEETS, JSON.stringify(filtered));
}

export async function getSessions(): Promise<PracticeSession[]> {
  const data = await AsyncStorage.getItem(KEYS.SESSIONS);
  return data ? JSON.parse(data) : [];
}

export async function saveSession(session: PracticeSession): Promise<void> {
  const sessions = await getSessions();
  sessions.unshift(session);
  await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
}

export async function getStats(): Promise<UserStats> {
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
}

export async function updateStats(stats: UserStats): Promise<void> {
  await AsyncStorage.setItem(KEYS.STATS, JSON.stringify(stats));
}

export function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}
