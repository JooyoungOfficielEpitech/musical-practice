import {
  getRecordings,
  saveRecording,
  deleteRecording,
  getRecordingsBySessionId,
} from "../../../client/lib/recordingStorage";
import type { Recording } from "../../../client/lib/audio/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

// expo-file-system mock
jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    uri,
    exists: true,
    delete: jest.fn(),
  })),
  Directory: jest.fn(),
  Paths: { document: "/mock/documents" },
}));

describe("recordingStorage", () => {
  const mockRecording: Recording = {
    id: "rec_001",
    sessionId: "session_001",
    title: "Practice Recording",
    fileUri: "/mock/documents/recordings/rec_001.wav",
    duration: 120,
    createdAt: 1710700000000,
    fileSize: 10584044,
  };

  const mockRecording2: Recording = {
    id: "rec_002",
    sessionId: "session_001",
    title: "Practice Recording 2",
    fileUri: "/mock/documents/recordings/rec_002.wav",
    duration: 60,
    createdAt: 1710700060000,
    fileSize: 5292044,
  };

  const mockRecording3: Recording = {
    id: "rec_003",
    sessionId: "session_002",
    title: "Different Session",
    fileUri: "/mock/documents/recordings/rec_003.wav",
    duration: 30,
    createdAt: 1710700120000,
    fileSize: 2646044,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe("getRecordings", () => {
    it("returns empty array when no recordings exist", async () => {
      const result = await getRecordings();
      expect(result).toEqual([]);
    });

    it("returns stored recordings", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([mockRecording])
      );

      const result = await getRecordings();
      expect(result).toEqual([mockRecording]);
    });

    it("returns empty array on parse error", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue("invalid json");

      const result = await getRecordings();
      expect(result).toEqual([]);
    });
  });

  describe("saveRecording", () => {
    it("saves a new recording to storage", async () => {
      const result = await saveRecording(mockRecording);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@musicalpractice/recordings",
        expect.any(String)
      );

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(savedData[0]).toEqual(mockRecording);
    });

    it("prepends new recording to existing list", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([mockRecording])
      );

      await saveRecording(mockRecording2);

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(savedData[0]).toEqual(mockRecording2);
      expect(savedData[1]).toEqual(mockRecording);
    });
  });

  describe("deleteRecording", () => {
    it("removes recording metadata from storage", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([mockRecording, mockRecording2])
      );

      await deleteRecording(mockRecording.id);

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe(mockRecording2.id);
    });

    it("handles deleting non-existent recording gracefully", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([mockRecording])
      );

      await expect(deleteRecording("non_existent")).resolves.not.toThrow();
    });
  });

  describe("getRecordingsBySessionId", () => {
    it("returns recordings for a specific session", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([mockRecording, mockRecording2, mockRecording3])
      );

      const result = await getRecordingsBySessionId("session_001");
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(mockRecording.id);
      expect(result[1].id).toBe(mockRecording2.id);
    });

    it("returns empty array when no recordings match session", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([mockRecording3])
      );

      const result = await getRecordingsBySessionId("session_001");
      expect(result).toEqual([]);
    });
  });
});
