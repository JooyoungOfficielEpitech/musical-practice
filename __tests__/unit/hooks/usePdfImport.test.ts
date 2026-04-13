import { renderHook, act } from "@testing-library/react-native";
import { usePdfImport } from "../../../client/hooks/usePdfImport";
import type { PageRange } from "../../../client/lib/pdfImport";

import * as pdfImport from "../../../client/lib/pdfImport";

jest.mock("../../../client/lib/pdfImport", () => ({
  pickPdf: jest.fn(),
  readFileAsBase64: jest.fn(),
  fetchPdfChunks: jest.fn(),
  defaultTitles: jest.fn((count: number, baseName: string) =>
    Array.from({ length: count }, (_, i) => `${baseName} — Section ${i + 1}`),
  ),
}));

const mockPickPdf = pdfImport.pickPdf as jest.Mock;
const mockReadFileAsBase64 = pdfImport.readFileAsBase64 as jest.Mock;
const mockFetchPdfChunks = pdfImport.fetchPdfChunks as jest.Mock;

const mockChunksResult = {
  chunks: [
    { pageRange: [1, 1] as PageRange, pngB64s: ["page1base64"] },
    { pageRange: [2, 2] as PageRange, pngB64s: ["page2base64"] },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockReadFileAsBase64.mockResolvedValue("pdfBase64");
  mockFetchPdfChunks.mockResolvedValue(mockChunksResult);
});

describe("usePdfImport", () => {
  it("initial state is idle, chunks is [], pageRanges is [], error is null", () => {
    const { result } = renderHook(() => usePdfImport());

    expect(result.current.state).toBe("idle");
    expect(result.current.chunks).toEqual([]);
    expect(result.current.pageRanges).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("startImport: when pickPdf returns null → state becomes error with message", async () => {
    mockPickPdf.mockResolvedValue(null);

    const { result } = renderHook(() => usePdfImport());

    await act(async () => {
      await result.current.startImport();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toBeTruthy();
  });

  it("startImport: transitions through picking→uploading→selecting, sets chunks on success", async () => {
    mockPickPdf.mockResolvedValue("file:///test.pdf");

    const { result } = renderHook(() => usePdfImport());

    await act(async () => {
      await result.current.startImport();
    });

    expect(result.current.state).toBe("selecting");
    expect(result.current.chunks).toEqual(mockChunksResult.chunks);
    expect(mockPickPdf).toHaveBeenCalledTimes(1);
    expect(mockReadFileAsBase64).toHaveBeenCalledWith("file:///test.pdf");
    expect(mockFetchPdfChunks).toHaveBeenCalledWith("pdfBase64", []);
  });

  it("startImport: when fetchPdfChunks throws → state becomes error", async () => {
    mockPickPdf.mockResolvedValue("file:///test.pdf");
    mockFetchPdfChunks.mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => usePdfImport());

    await act(async () => {
      await result.current.startImport();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe("Server error");
  });

  it("setPageRanges: updates pageRanges", () => {
    const { result } = renderHook(() => usePdfImport());

    act(() => {
      result.current.setPageRanges([[1, 3], [4, 6]]);
    });

    expect(result.current.pageRanges).toEqual([[1, 3], [4, 6]]);
  });

  it("confirmRanges does not exist on hook return value (removed dead code)", () => {
    const { result } = renderHook(() => usePdfImport());
    expect((result.current as unknown as Record<string, unknown>)["confirmRanges"]).toBeUndefined();
  });

  it("proceedToNaming: transitions from selecting to naming and sets default section titles", async () => {
    mockPickPdf.mockResolvedValue("file:///test.pdf");

    const { result } = renderHook(() => usePdfImport());

    // Reach selecting state
    await act(async () => {
      await result.current.startImport();
    });
    expect(result.current.state).toBe("selecting");

    // Set 2 page ranges then proceed to naming
    act(() => {
      result.current.setPageRanges([[1, 3], [4, 6]]);
    });

    act(() => {
      result.current.proceedToNaming();
    });

    expect(result.current.state).toBe("naming");
    expect(result.current.sectionTitles).toHaveLength(2);
    expect(result.current.sectionTitles[0]).toContain("Section 1");
    expect(result.current.sectionTitles[1]).toContain("Section 2");
  });

  it("setSectionTitle: updates title at given index", async () => {
    mockPickPdf.mockResolvedValue("file:///test.pdf");

    const { result } = renderHook(() => usePdfImport());

    await act(async () => {
      await result.current.startImport();
    });

    act(() => {
      result.current.setPageRanges([[1, 3], [4, 6]]);
      result.current.proceedToNaming();
    });

    act(() => {
      result.current.setSectionTitle(0, "Overture");
    });

    expect(result.current.sectionTitles[0]).toBe("Overture");
    expect(result.current.sectionTitles[1]).toContain("Section 2");
  });

  it("reset: returns to idle, clears chunks, clears error", async () => {
    mockPickPdf.mockResolvedValue(null);

    const { result } = renderHook(() => usePdfImport());

    // Get to error state
    await act(async () => {
      await result.current.startImport();
    });
    expect(result.current.state).toBe("error");

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.chunks).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
