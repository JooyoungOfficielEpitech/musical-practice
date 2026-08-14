/**
 * Tests for client/hooks/useRecording.ts — chunk capture and WAV persistence.
 */
const mockWrite = jest.fn();
const mockCreate = jest.fn();
jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation(() => ({
    uri: "file:///doc/recordings/take.wav",
    write: mockWrite,
  })),
  Directory: jest.fn().mockImplementation(() => ({ exists: false, create: mockCreate })),
  Paths: { document: "file:///doc" },
}));

const mockEncodeWav: jest.Mock = jest.fn(() => new ArrayBuffer(64));
jest.mock("../../../client/lib/audio/wavEncoder", () => ({
  encodeWav: (chunks: unknown, rate: unknown) => mockEncodeWav(chunks, rate),
}));

const mockSaveRecording = jest.fn().mockResolvedValue(undefined);
jest.mock("../../../client/lib/recordingStorage", () => ({
  saveRecording: (...args: unknown[]) => mockSaveRecording(...args),
}));

import { renderHook, act } from "@testing-library/react-native";
import { useRecording } from "../../../client/hooks/useRecording";

beforeEach(() => jest.clearAllMocks());

describe("useRecording", () => {
  it("captures chunks only while recording and persists a WAV take", async () => {
    const { result } = renderHook(() => useRecording());

    act(() => result.current.addAudioData(new Float32Array([0.5]))); // pre-start: ignored
    act(() => result.current.startRecording());
    expect(result.current.isRecording).toBe(true);
    act(() => result.current.addAudioData(new Float32Array([0.1, 0.2])));
    act(() => result.current.addAudioData(new Float32Array([0.3])));

    let takeResult: unknown = null;
    await act(async () => { takeResult = await result.current.stopRecording("sheet-1"); });

    expect(result.current.isRecording).toBe(false);
    expect(mockEncodeWav).toHaveBeenCalledTimes(1);
    const encodedChunks = mockEncodeWav.mock.calls[0][0] as unknown as Float32Array[];
    expect(encodedChunks.length).toBe(2); // pre-start chunk excluded
    expect(mockWrite).toHaveBeenCalled();
    expect(mockSaveRecording).toHaveBeenCalledWith(
      expect.objectContaining({ sheetId: "sheet-1", fileUri: "file:///doc/recordings/take.wav" }),
    );
    expect(takeResult).toEqual(
      expect.objectContaining({ uri: "file:///doc/recordings/take.wav" }),
    );
  });

  it("returns null when nothing was captured", async () => {
    const { result } = renderHook(() => useRecording());
    act(() => result.current.startRecording());

    let takeResult: unknown = {};
    await act(async () => { takeResult = await result.current.stopRecording("sheet-1"); });

    expect(takeResult).toBeNull();
    expect(mockSaveRecording).not.toHaveBeenCalled();
  });

  it("discard throws the chunks away without saving", async () => {
    const { result } = renderHook(() => useRecording());
    act(() => result.current.startRecording());
    act(() => result.current.addAudioData(new Float32Array([0.1])));
    act(() => result.current.discard());

    let takeResult: unknown = {};
    await act(async () => { takeResult = await result.current.stopRecording("sheet-1"); });
    expect(takeResult).toBeNull();
  });
});
