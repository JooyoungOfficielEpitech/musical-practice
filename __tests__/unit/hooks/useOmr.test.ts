import { renderHook, act } from "@testing-library/react-native";
import { useOmr } from "../../../client/hooks/useOmr";
import type { SheetMusic } from "../../../client/lib/storage";

// Mock the OMR service
const mockProcessSheetMusicImage = jest.fn();
jest.mock("../../../client/lib/omr", () => ({
  processSheetMusicImage: (...args: unknown[]) => mockProcessSheetMusicImage(...args),
  getOmrStatus: jest.fn((s?: string) => {
    if (s === "processing" || s === "ready" || s === "failed") return s;
    return "none";
  }),
}));

// Mock storage
const mockUpdateSheet = jest.fn().mockResolvedValue(undefined);
jest.mock("../../../client/lib/storage", () => ({
  updateSheet: (...args: unknown[]) => mockUpdateSheet(...args),
  getSheets: jest.fn().mockResolvedValue([]),
}));

const mockSheet: SheetMusic = {
  id: "sheet-1",
  title: "Test Sheet",
  artist: "Test Artist",
  imageUris: ["file:///image.jpg"],
  createdAt: Date.now(),
  folder: "default",
  isFavorite: false,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useOmr", () => {
  it("initializes with correct default state", () => {
    const { result } = renderHook(() => useOmr());

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe("none");
    expect(typeof result.current.processImage).toBe("function");
  });

  it("sets isProcessing=true during processing", async () => {
    let resolvePromise: (value: unknown) => void;
    mockProcessSheetMusicImage.mockReturnValue(
      new Promise((resolve) => { resolvePromise = resolve; }),
    );

    const { result } = renderHook(() => useOmr());

    let processPromise: Promise<unknown>;
    act(() => {
      processPromise = result.current.processImage("file:///img.jpg", mockSheet);
    });

    expect(result.current.isProcessing).toBe(true);
    expect(result.current.status).toBe("processing");

    await act(async () => {
      resolvePromise!({
        musicXmlUri: "file:///xml",
        noteSequenceUri: "file:///json",
        noteSequence: [],
      });
      await processPromise!;
    });

    expect(result.current.isProcessing).toBe(false);
  });

  it("returns OmrResult on success", async () => {
    const mockResult = {
      musicXmlUri: "file:///xml",
      noteSequenceUri: "file:///json",
      noteSequence: [
        { pitch: "C4", midiNumber: 60, frequency: 261.63, startTime: 0, duration: 0.5, velocity: 80 },
      ],
    };
    mockProcessSheetMusicImage.mockResolvedValue(mockResult);

    const { result } = renderHook(() => useOmr());

    let omrResult: unknown;
    await act(async () => {
      omrResult = await result.current.processImage("file:///img.jpg", mockSheet);
    });

    expect(omrResult).toEqual(mockResult);
    expect(result.current.status).toBe("ready");
    expect(result.current.error).toBeNull();
  });

  it('updates sheet status to "processing" at start', async () => {
    mockProcessSheetMusicImage.mockResolvedValue({
      musicXmlUri: "file:///xml",
      noteSequenceUri: "file:///json",
      noteSequence: [],
    });

    const { result } = renderHook(() => useOmr());

    await act(async () => {
      await result.current.processImage("file:///img.jpg", mockSheet);
    });

    // First call should set omrStatus to "processing"
    expect(mockUpdateSheet).toHaveBeenCalledWith(
      expect.objectContaining({ omrStatus: "processing" }),
    );
  });

  it('updates sheet status to "ready" on success', async () => {
    mockProcessSheetMusicImage.mockResolvedValue({
      musicXmlUri: "file:///xml",
      noteSequenceUri: "file:///json",
      noteSequence: [],
    });

    const { result } = renderHook(() => useOmr());

    await act(async () => {
      await result.current.processImage("file:///img.jpg", mockSheet);
    });

    // Last call should set omrStatus to "ready"
    const lastCall = mockUpdateSheet.mock.calls[mockUpdateSheet.mock.calls.length - 1][0];
    expect(lastCall.omrStatus).toBe("ready");
  });

  it("sets error and status=failed on processing failure", async () => {
    mockProcessSheetMusicImage.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useOmr());

    await act(async () => {
      await result.current.processImage("file:///img.jpg", mockSheet);
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.status).toBe("failed");
    expect(result.current.isProcessing).toBe(false);
  });

  it("returns null on failure", async () => {
    mockProcessSheetMusicImage.mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() => useOmr());

    let omrResult: unknown;
    await act(async () => {
      omrResult = await result.current.processImage("file:///img.jpg", mockSheet);
    });

    expect(omrResult).toBeNull();
  });

  it('updates sheet status to "failed" on error', async () => {
    mockProcessSheetMusicImage.mockRejectedValue(new Error("OMR error"));

    const { result } = renderHook(() => useOmr());

    await act(async () => {
      await result.current.processImage("file:///img.jpg", mockSheet);
    });

    const lastCall = mockUpdateSheet.mock.calls[mockUpdateSheet.mock.calls.length - 1][0];
    expect(lastCall.omrStatus).toBe("failed");
  });

  it("clears error on new processing attempt", async () => {
    // First call fails
    mockProcessSheetMusicImage.mockRejectedValueOnce(new Error("fail"));

    const { result } = renderHook(() => useOmr());

    await act(async () => {
      await result.current.processImage("file:///img.jpg", mockSheet);
    });
    expect(result.current.error).toBe("fail");

    // Second call succeeds
    mockProcessSheetMusicImage.mockResolvedValueOnce({
      musicXmlUri: "file:///xml",
      noteSequenceUri: "file:///json",
      noteSequence: [],
    });

    await act(async () => {
      await result.current.processImage("file:///img.jpg", mockSheet);
    });
    expect(result.current.error).toBeNull();
  });
});
