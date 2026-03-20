import { renderHook, act } from "@testing-library/react-native";
import { useRecording } from "../../../client/hooks/useRecording";

// Mock dependencies
jest.mock("../../../client/lib/audio/wavEncoder", () => ({
  encodeWav: jest.fn().mockReturnValue(new ArrayBuffer(44)),
}));

jest.mock("../../../client/lib/recordingStorage", () => ({
  saveRecording: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-file-system", () => {
  const mockWrite = jest.fn();
  return {
    File: jest.fn().mockImplementation((...args: any[]) => ({
      uri: typeof args[0] === "string"
        ? args[0]
        : `${args[0]}/${args[1]}`,
      exists: false,
      write: mockWrite,
      create: jest.fn(),
    })),
    Directory: jest.fn().mockImplementation((...args: any[]) => ({
      uri: `${args[0]}/${args[1]}`,
      exists: false,
      create: jest.fn(),
    })),
    Paths: { document: "/mock/documents" },
  };
});

jest.mock("../../../client/lib/storage", () => ({
  generateId: jest.fn().mockReturnValue("mock_recording_id"),
}));

const { encodeWav } = jest.requireMock("../../../client/lib/audio/wavEncoder");
const { saveRecording } = jest.requireMock("../../../client/lib/recordingStorage");

describe("useRecording", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts with initial state (not recording)", () => {
    const { result } = renderHook(() => useRecording());

    expect(result.current.isRecording).toBe(false);
    expect(result.current.recordingDuration).toBe(0);
  });

  it("transitions to recording state on startRecording", () => {
    const { result } = renderHook(() => useRecording());

    act(() => {
      result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);
  });

  it("transitions back to not recording on stopRecording", async () => {
    const { result } = renderHook(() => useRecording());

    act(() => {
      result.current.startRecording();
    });

    await act(async () => {
      await result.current.stopRecording("session_123");
    });

    expect(result.current.isRecording).toBe(false);
  });

  it("accumulates audio data via addAudioData", () => {
    const { result } = renderHook(() => useRecording());

    act(() => {
      result.current.startRecording();
    });

    act(() => {
      result.current.addAudioData(new Float32Array([0.1, 0.2, 0.3]));
      result.current.addAudioData(new Float32Array([0.4, 0.5]));
    });

    // Data is accumulated internally - verified by stopRecording producing a WAV
    expect(result.current.isRecording).toBe(true);
  });

  it("ignores addAudioData when not recording", () => {
    const { result } = renderHook(() => useRecording());

    // Not recording - should not throw
    act(() => {
      result.current.addAudioData(new Float32Array([0.1, 0.2]));
    });

    expect(result.current.isRecording).toBe(false);
  });

  it("calls encodeWav and saveRecording on stopRecording", async () => {
    const { result } = renderHook(() => useRecording());

    act(() => {
      result.current.startRecording();
    });

    act(() => {
      result.current.addAudioData(new Float32Array([0.1, 0.2, 0.3]));
    });

    await act(async () => {
      await result.current.stopRecording("session_123");
    });

    expect(encodeWav).toHaveBeenCalledWith(
      expect.arrayContaining([expect.any(Float32Array)]),
      44100
    );
    expect(saveRecording).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "mock_recording_id",
        sessionId: "session_123",
      })
    );
  });

  it("returns the recording URI after stopRecording", async () => {
    const { result } = renderHook(() => useRecording());

    act(() => {
      result.current.startRecording();
    });

    act(() => {
      result.current.addAudioData(new Float32Array([0.1, 0.2]));
    });

    let uri: string | null = null;
    await act(async () => {
      uri = await result.current.stopRecording("session_123");
    });

    expect(uri).toBeTruthy();
    expect(typeof uri).toBe("string");
  });

  it("returns null if stopRecording called without data", async () => {
    const { result } = renderHook(() => useRecording());

    act(() => {
      result.current.startRecording();
    });

    let uri: string | null = null;
    await act(async () => {
      uri = await result.current.stopRecording("session_123");
    });

    expect(uri).toBeNull();
  });

  it("resets chunks after stopRecording for next recording", async () => {
    const { result } = renderHook(() => useRecording());

    // First recording
    act(() => {
      result.current.startRecording();
    });
    act(() => {
      result.current.addAudioData(new Float32Array([0.1, 0.2]));
    });
    await act(async () => {
      await result.current.stopRecording("session_1");
    });

    // Second recording - should not contain first recording's data
    encodeWav.mockClear();

    act(() => {
      result.current.startRecording();
    });
    act(() => {
      result.current.addAudioData(new Float32Array([0.9]));
    });
    await act(async () => {
      await result.current.stopRecording("session_2");
    });

    // encodeWav should be called with only the second recording's chunk
    const chunks = encodeWav.mock.calls[0][0];
    expect(chunks).toHaveLength(1);
    expect(chunks[0][0]).toBeCloseTo(0.9);
  });
});
