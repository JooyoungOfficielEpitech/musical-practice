import { renderHook, act } from "@testing-library/react-native";
import { usePdfImport } from "../../../client/hooks/usePdfImport";

import * as pdfImport from "../../../client/lib/pdfImport";

jest.mock("../../../client/lib/pdfImport", () => ({
  pickPdf: jest.fn(),
  readFileAsBase64: jest.fn(),
  fetchPdfChunks: jest.fn(),
}));

const mockPickPdf = pdfImport.pickPdf as jest.Mock;
const mockReadFileAsBase64 = pdfImport.readFileAsBase64 as jest.Mock;
const mockFetchPdfChunks = pdfImport.fetchPdfChunks as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockReadFileAsBase64.mockResolvedValue("pdfBase64");
  mockFetchPdfChunks.mockResolvedValue({ chunks: [] });
});

describe("usePdfImport — Phase 2", () => {
  it("initial state is idle, pdfB64 is null, error is null", () => {
    const { result } = renderHook(() => usePdfImport());

    expect(result.current.state).toBe("idle");
    expect(result.current.pdfB64).toBeNull();
    expect(result.current.fileName).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("startImport: when pickPdf returns null → state becomes error", async () => {
    mockPickPdf.mockResolvedValue(null);

    const { result } = renderHook(() => usePdfImport());

    await act(async () => {
      await result.current.startImport();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe("No file selected");
  });

  it("startImport: transitions picking→uploading, auto-names from filename", async () => {
    mockPickPdf.mockResolvedValue("file:///documents/Symphony-No-5.pdf");

    const { result } = renderHook(() => usePdfImport());

    await act(async () => {
      await result.current.startImport();
    });

    expect(result.current.state).toBe("uploading");
    expect(result.current.fileName).toBe("Symphony-No-5.pdf");
    expect(result.current.sectionTitles[0]).toBe("Symphony No 5");
    expect(mockPickPdf).toHaveBeenCalledTimes(1);
    expect(mockReadFileAsBase64).toHaveBeenCalledWith("file:///documents/Symphony-No-5.pdf");
  });

  it("startImport: when fetchPdfChunks throws (offline) → proceeds to uploading with fallback", async () => {
    mockPickPdf.mockResolvedValue("file:///test.pdf");
    mockFetchPdfChunks.mockRejectedValue(new Error("Network request failed"));

    const { result } = renderHook(() => usePdfImport());

    await act(async () => {
      await result.current.startImport();
    });

    // Should still reach uploading state (fallback mode)
    expect(result.current.state).toBe("uploading");
    expect(result.current.sectionTitles[0]).toBe("test");
  });

  it("reset: returns to idle, clears everything", async () => {
    mockPickPdf.mockResolvedValue("file:///test.pdf");

    const { result } = renderHook(() => usePdfImport());

    await act(async () => {
      await result.current.startImport();
    });
    expect(result.current.state).toBe("uploading");

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.pdfB64).toBeNull();
    expect(result.current.fileName).toBeNull();
    expect(result.current.sectionTitles).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("removed states: selecting, naming do not exist", () => {
    const { result } = renderHook(() => usePdfImport());
    expect((result.current as any)["setPageRanges"]).toBeUndefined();
    expect((result.current as any)["setSectionTitle"]).toBeUndefined();
    expect((result.current as any)["proceedToNaming"]).toBeUndefined();
  });
});
