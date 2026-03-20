/**
 * End-to-end integration test for the recording flow:
 * 1. Start recording → audio data flows in
 * 2. Stop recording with session ID → WAV file saved + metadata stored
 * 3. Recordings retrievable by session ID
 * 4. sheetRecordings filter finds recordings linked to correct sessions
 */
import { renderHook, act } from "@testing-library/react-native";
import { useRecording } from "../../client/hooks/useRecording";
import {
  getRecordings,
  saveRecording,
  getRecordingsBySessionId,
} from "../../client/lib/recordingStorage";
import { generateId } from "../../client/lib/storage";
import type { Recording } from "../../client/lib/audio/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Mock expo-file-system
const mockFileWrite = jest.fn();
const mockDirExists = true;
const mockDirCreate = jest.fn();
jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation((_dir: unknown, name: string) => ({
    uri: `/mock/documents/recordings/${name}`,
    write: mockFileWrite,
  })),
  Directory: jest.fn().mockImplementation(() => ({
    exists: mockDirExists,
    create: mockDirCreate,
  })),
  Paths: { document: "/mock/documents" },
}));

// Mock wavEncoder
const mockEncodeWav = jest.fn().mockReturnValue(new ArrayBuffer(100));
jest.mock("../../client/lib/audio/wavEncoder", () => ({
  encodeWav: (...args: unknown[]) => mockEncodeWav(...args),
}));

describe("Recording flow: start → data → stop → save → retrieve", () => {
  let recordingsStore: Recording[];

  beforeEach(() => {
    jest.clearAllMocks();
    recordingsStore = [];

    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === "@musicalpractice/recordings") {
        return Promise.resolve(JSON.stringify(recordingsStore));
      }
      return Promise.resolve(null);
    });

    (AsyncStorage.setItem as jest.Mock).mockImplementation(
      (key: string, value: string) => {
        if (key === "@musicalpractice/recordings") {
          recordingsStore = JSON.parse(value);
        }
        return Promise.resolve();
      },
    );
  });

  it("RED: recording with audio data saves file and metadata", async () => {
    const { result } = renderHook(() => useRecording());

    // 1. Start recording
    act(() => {
      result.current.startRecording();
    });
    expect(result.current.isRecording).toBe(true);

    // 2. Feed audio data (simulating LiveAudioStream callbacks)
    act(() => {
      result.current.addAudioData(new Float32Array([0.1, 0.2, 0.3]));
      result.current.addAudioData(new Float32Array([0.4, 0.5, 0.6]));
      result.current.addAudioData(new Float32Array([0.7, 0.8, 0.9]));
    });

    // 3. Stop recording with a session ID
    const sessionId = generateId();
    let uri: string | null = null;
    await act(async () => {
      uri = await result.current.stopRecording(sessionId);
    });

    // 4. Verify: WAV encoded with all chunks
    expect(mockEncodeWav).toHaveBeenCalledTimes(1);
    const encodedChunks = mockEncodeWav.mock.calls[0][0];
    expect(encodedChunks).toHaveLength(3);

    // 5. Verify: file written
    expect(mockFileWrite).toHaveBeenCalledTimes(1);

    // 6. Verify: URI returned
    expect(uri).not.toBeNull();
    expect(uri).toContain("/mock/documents/recordings/");
    expect(uri).toContain(".wav");

    // 7. Verify: metadata saved to AsyncStorage
    expect(recordingsStore).toHaveLength(1);
    expect(recordingsStore[0].sessionId).toBe(sessionId);
    expect(recordingsStore[0].fileUri).toBe(uri);
    expect(recordingsStore[0].duration).toBeGreaterThanOrEqual(0);
    expect(recordingsStore[0].fileSize).toBe(100); // mock ArrayBuffer size
  });

  it("RED: recording is retrievable by session ID after save", async () => {
    const { result } = renderHook(() => useRecording());
    const sessionId = generateId();

    act(() => {
      result.current.startRecording();
      result.current.addAudioData(new Float32Array([0.1, 0.2]));
    });

    await act(async () => {
      await result.current.stopRecording(sessionId);
    });

    // Retrieve by session ID
    const found = await getRecordingsBySessionId(sessionId);
    expect(found).toHaveLength(1);
    expect(found[0].sessionId).toBe(sessionId);
  });

  it("RED: no recording saved when zero audio chunks", async () => {
    const { result } = renderHook(() => useRecording());
    const sessionId = generateId();

    act(() => {
      result.current.startRecording();
      // No addAudioData calls — simulates broken audio stream
    });

    let uri: string | null = null;
    await act(async () => {
      uri = await result.current.stopRecording(sessionId);
    });

    // No recording should be saved
    expect(uri).toBeNull();
    expect(mockEncodeWav).not.toHaveBeenCalled();
    expect(mockFileWrite).not.toHaveBeenCalled();
    expect(recordingsStore).toHaveLength(0);
  });

  it("RED: sheetRecordings filter matches recordings to sessions", async () => {
    // Simulate two sessions for different sheets
    const sessionA = generateId();
    const sessionB = generateId();

    // Save recordings for each session
    const { result } = renderHook(() => useRecording());

    act(() => {
      result.current.startRecording();
      result.current.addAudioData(new Float32Array([0.1]));
    });
    await act(async () => {
      await result.current.stopRecording(sessionA);
    });

    act(() => {
      result.current.startRecording();
      result.current.addAudioData(new Float32Array([0.2]));
    });
    await act(async () => {
      await result.current.stopRecording(sessionB);
    });

    // All recordings in store
    const all = await getRecordings();
    expect(all).toHaveLength(2);

    // Simulate sheetRecordings filter (same logic as PracticeDetailScreen)
    const sheetASessions = [{ id: sessionA }];
    const sessionIds = new Set(sheetASessions.map((s) => s.id));
    const sheetARecordings = all.filter((r) => sessionIds.has(r.sessionId));

    expect(sheetARecordings).toHaveLength(1);
    expect(sheetARecordings[0].sessionId).toBe(sessionA);
  });

  it("RED: addAudioData ignored when not recording", async () => {
    const { result } = renderHook(() => useRecording());

    // Add data WITHOUT starting recording
    act(() => {
      result.current.addAudioData(new Float32Array([0.1, 0.2]));
    });

    // Start and immediately stop
    const sessionId = generateId();
    act(() => {
      result.current.startRecording();
    });

    let uri: string | null = null;
    await act(async () => {
      uri = await result.current.stopRecording(sessionId);
    });

    // The pre-start data should NOT be in chunks
    expect(uri).toBeNull();
  });
});
