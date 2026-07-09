import { renderHook, act } from "@testing-library/react-native";
import { usePdfImport } from "../../../client/hooks/usePdfImport";

import * as pdfImport from "../../../client/lib/pdfImport";

jest.mock("../../../client/lib/pdfImport", () => ({
  pickPdf: jest.fn(),
  readFileAsBase64: jest.fn(),
}));

const mockPickPdf = pdfImport.pickPdf as jest.Mock;
const mockReadFileAsBase64 = pdfImport.readFileAsBase64 as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockReadFileAsBase64.mockResolvedValue("pdfBase64");
});

describe("usePdfImport", () => {
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

  it("startImport: auto-names from the document's real name, not the cache URI", async () => {
    mockPickPdf.mockResolvedValue({
      uri: "file:///cache/DocumentPicker/7F9A2B1C-3D4E.pdf",
      name: "Symphony-No-5.pdf",
    });

    const { result } = renderHook(() => usePdfImport());

    await act(async () => {
      await result.current.startImport();
    });

    expect(result.current.state).toBe("uploading");
    expect(result.current.fileName).toBe("Symphony-No-5.pdf");
    expect(result.current.sectionTitles[0]).toBe("Symphony No 5");
    expect(mockPickPdf).toHaveBeenCalledTimes(1);
    expect(mockReadFileAsBase64).toHaveBeenCalledWith(
      "file:///cache/DocumentPicker/7F9A2B1C-3D4E.pdf",
    );
  });

  it("startImport: falls back to 'Score' when the name strips to empty", async () => {
    mockPickPdf.mockResolvedValue({ uri: "file:///cache/x.pdf", name: "-.pdf" });

    const { result } = renderHook(() => usePdfImport());

    await act(async () => {
      await result.current.startImport();
    });

    expect(result.current.sectionTitles[0]).toBe("Score");
  });

  it("reset: returns to idle, clears everything", async () => {
    mockPickPdf.mockResolvedValue({ uri: "file:///test.pdf", name: "test.pdf" });

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
});
