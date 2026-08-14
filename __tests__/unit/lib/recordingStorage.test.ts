/**
 * Tests for client/lib/recordingStorage.ts — one latest take per sheet.
 */
const mockDelete = jest.fn();
jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation((uri: string) => ({ uri, delete: mockDelete })),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getRecordings,
  getLatestRecordingForSheet,
  saveRecording,
  deleteRecordingsForSheet,
} from "../../../client/lib/recordingStorage";
import type { Recording } from "../../../client/lib/audio/types";

function take(id: string, sheetId: string): Recording {
  return {
    id, sheetId, title: `Take ${id}`, fileUri: `file:///rec/${id}.wav`,
    duration: 30, createdAt: 1000, fileSize: 1234,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe("recordingStorage", () => {
  it("saves and reads back the latest take for a sheet", async () => {
    await saveRecording(take("a", "s1"));
    const latest = await getLatestRecordingForSheet("s1");
    expect(latest?.id).toBe("a");
    expect(await getLatestRecordingForSheet("other")).toBeNull();
  });

  it("a new take replaces the previous one for the same sheet and deletes its file", async () => {
    await saveRecording(take("a", "s1"));
    await saveRecording(take("b", "s1"));

    const all = await getRecordings();
    expect(all.filter((r) => r.sheetId === "s1")).toHaveLength(1);
    expect((await getLatestRecordingForSheet("s1"))?.id).toBe("b");
    expect(mockDelete).toHaveBeenCalledTimes(1); // old file removed
  });

  it("keeps takes of other sheets intact", async () => {
    await saveRecording(take("a", "s1"));
    await saveRecording(take("b", "s2"));
    expect((await getLatestRecordingForSheet("s1"))?.id).toBe("a");
    expect((await getLatestRecordingForSheet("s2"))?.id).toBe("b");
  });

  it("deleteRecordingsForSheet removes entries and files", async () => {
    await saveRecording(take("a", "s1"));
    await deleteRecordingsForSheet("s1");
    expect(await getLatestRecordingForSheet("s1")).toBeNull();
    expect(mockDelete).toHaveBeenCalled();
  });
});
