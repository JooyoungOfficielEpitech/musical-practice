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

export async function saveRecording(recording: Recording): Promise<void> {
  const recordings = await getRecordings();
  recordings.unshift(recording);
  await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(recordings));
}

export async function deleteRecording(id: string): Promise<void> {
  const recordings = await getRecordings();
  const target = recordings.find((r) => r.id === id);

  // Delete the audio file
  if (target) {
    try {
      const file = new File(target.fileUri);
      file.delete();
    } catch {
      // File may already be deleted
    }
  }

  const filtered = recordings.filter((r) => r.id !== id);
  await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(filtered));
}

export async function renameRecording(id: string, newTitle: string): Promise<void> {
  const recordings = await getRecordings();
  const idx = recordings.findIndex((r) => r.id === id);
  if (idx !== -1) {
    recordings[idx].title = newTitle;
    await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(recordings));
  }
}

export async function getRecordingsBySessionId(
  sessionId: string,
): Promise<Recording[]> {
  const recordings = await getRecordings();
  return recordings.filter((r) => r.sessionId === sessionId);
}
