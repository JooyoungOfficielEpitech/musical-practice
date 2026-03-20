/**
 * Integration test: verifies that recordings are linked to sessions
 * by a shared session ID, so they appear in the correct sheet's recordings list.
 */
import {
  saveSession,
  generateId,
  type PracticeSession,
} from "../../client/lib/storage";
import {
  saveRecording,
  getRecordingsBySessionId,
} from "../../client/lib/recordingStorage";
import type { Recording } from "../../client/lib/audio/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    uri,
    exists: true,
    delete: jest.fn(),
  })),
  Directory: jest.fn(),
  Paths: { document: "/mock/documents" },
}));

describe("Recording ↔ Session linkage", () => {
  let recordingsStore: Recording[] = [];
  let sessionsStore: PracticeSession[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    recordingsStore = [];
    sessionsStore = [];

    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === "@musicalpractice/recordings") {
        return Promise.resolve(JSON.stringify(recordingsStore));
      }
      if (key === "@musicalpractice/sessions") {
        return Promise.resolve(JSON.stringify(sessionsStore));
      }
      return Promise.resolve(null);
    });

    (AsyncStorage.setItem as jest.Mock).mockImplementation(
      (key: string, value: string) => {
        if (key === "@musicalpractice/recordings") {
          recordingsStore = JSON.parse(value);
        }
        if (key === "@musicalpractice/sessions") {
          sessionsStore = JSON.parse(value);
        }
        return Promise.resolve();
      },
    );
  });

  it("recording is found when sessionId matches the session id (correct flow)", async () => {
    // Simulate the FIXED flow:
    // 1. Save session, get its ID
    const sessionId = generateId();
    const session: PracticeSession = {
      id: sessionId,
      sheetMusicId: "sheet_001",
      sheetMusicTitle: "Test Sheet",
      startedAt: Date.now() - 30000,
      duration: 30,
      accuracy: 85,
      bpm: 120,
    };
    await saveSession(session);

    // 2. Save recording with the same sessionId
    const recording: Recording = {
      id: "rec_test",
      sessionId,
      title: "Test Recording",
      fileUri: "/mock/rec.wav",
      duration: 30,
      createdAt: Date.now(),
      fileSize: 1000,
    };
    await saveRecording(recording);

    // 3. Verify recording is retrievable by the session's ID
    const found = await getRecordingsBySessionId(sessionId);
    expect(found).toHaveLength(1);
    expect(found[0].sessionId).toBe(sessionId);
    expect(found[0].sessionId).toBe(session.id);
  });

  it("old broken flow: recording NOT found because IDs differ", async () => {
    // OLD broken flow: recording gets sheet.id + timestamp, session gets generateId()
    const recordingSessionId = "sheet123_1710700000000";
    const session: PracticeSession = {
      id: generateId(), // different from recordingSessionId
      sheetMusicId: "sheet123",
      sheetMusicTitle: "Test",
      startedAt: Date.now(),
      duration: 30,
      accuracy: 85,
      bpm: 120,
    };
    await saveSession(session);

    const recording: Recording = {
      id: "rec_broken",
      sessionId: recordingSessionId,
      title: "Broken",
      fileUri: "/mock/rec.wav",
      duration: 30,
      createdAt: Date.now(),
      fileSize: 1000,
    };
    await saveRecording(recording);

    // Recording NOT found by session's actual ID
    const found = await getRecordingsBySessionId(session.id);
    expect(found).toHaveLength(0);
  });

  it("multiple recordings for the same session are all retrievable", async () => {
    const sessionId = generateId();

    await saveRecording({
      id: "rec_1",
      sessionId,
      title: "Rec 1",
      fileUri: "/mock/1.wav",
      duration: 30,
      createdAt: Date.now(),
      fileSize: 1000,
    });
    await saveRecording({
      id: "rec_2",
      sessionId,
      title: "Rec 2",
      fileUri: "/mock/2.wav",
      duration: 60,
      createdAt: Date.now(),
      fileSize: 2000,
    });

    const found = await getRecordingsBySessionId(sessionId);
    expect(found).toHaveLength(2);
    expect(found.every((r) => r.sessionId === sessionId)).toBe(true);
  });

  it("recordings for different sessions are isolated", async () => {
    const sessionA = generateId();
    const sessionB = generateId();

    await saveRecording({
      id: "rec_a",
      sessionId: sessionA,
      title: "Session A",
      fileUri: "/mock/a.wav",
      duration: 30,
      createdAt: Date.now(),
      fileSize: 1000,
    });
    await saveRecording({
      id: "rec_b",
      sessionId: sessionB,
      title: "Session B",
      fileUri: "/mock/b.wav",
      duration: 30,
      createdAt: Date.now(),
      fileSize: 1000,
    });

    const foundA = await getRecordingsBySessionId(sessionA);
    const foundB = await getRecordingsBySessionId(sessionB);
    expect(foundA).toHaveLength(1);
    expect(foundA[0].id).toBe("rec_a");
    expect(foundB).toHaveLength(1);
    expect(foundB[0].id).toBe("rec_b");
  });
});
