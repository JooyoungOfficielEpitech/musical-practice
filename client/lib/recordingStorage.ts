/**
 * Sing-along take storage. Deliberately minimal: ONE latest take per sheet —
 * a new take replaces (and deletes) the previous file so storage stays flat.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";
import type { Recording } from "./audio/types";

const RECORDINGS_KEY = "@musicalpractice/recordings";

export async function getRecordings(): Promise<Recording[]> {
  try {
    const data = await AsyncStorage.getItem(RECORDINGS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function getLatestRecordingForSheet(sheetId: string): Promise<Recording | null> {
  const recordings = await getRecordings();
  return recordings.find((r) => r.sheetId === sheetId) ?? null;
}

/** Save a take, replacing any previous take for the same sheet (file included). */
export async function saveRecording(recording: Recording): Promise<void> {
  const recordings = await getRecordings();
  const previous = recordings.filter((r) => r.sheetId === recording.sheetId);
  for (const old of previous) {
    try {
      new File(old.fileUri).delete();
    } catch {
      // File may already be gone.
    }
  }
  const next = [recording, ...recordings.filter((r) => r.sheetId !== recording.sheetId)];
  await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(next));
}

export async function deleteRecordingsForSheet(sheetId: string): Promise<void> {
  const recordings = await getRecordings();
  for (const r of recordings.filter((x) => x.sheetId === sheetId)) {
    try {
      new File(r.fileUri).delete();
    } catch {
      // ignore
    }
  }
  await AsyncStorage.setItem(
    RECORDINGS_KEY,
    JSON.stringify(recordings.filter((r) => r.sheetId !== sheetId)),
  );
}
