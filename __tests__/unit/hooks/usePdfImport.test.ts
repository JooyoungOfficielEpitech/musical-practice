import { renderHook, act } from "@testing-library/react-native";
import { usePdfImport } from "../../../client/hooks/usePdfImport";

import * as pdfImport from "../../../client/lib/pdfImport";

jest.mock("../../../client/lib/pdfImport", () => ({
  pickPdf: jest.fn(),
  readFileAsBase64: jest.fn(),
  estimatePdfPageCount: jest.fn(),
}));

const mockPickPdf = pdfImport.pickPdf as jest.Mock;
const mockReadFileAsBase64 = pdfImport.readFileAsBase64 as jest.Mock;
const mockEstimatePages = pdfImport.estimatePdfPageCount as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockReadFileAsBase64.mockResolvedValue("pdfBase64");
  mockEstimatePages.mockReturnValue(4);
});

describe("usePdfImport", () => {
  it("initial state is idle with nothing loaded", () => {
    const { result } = renderHook(() => usePdfImport());

    expect(result.current.state).toBe("idle");
    expect(result.current.pdfB64).toBeNull();
    expect(result.current.fileName).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("cancelling the picker returns to idle — NOT an error", async () => {
    mockPickPdf.mockResolvedValue(null);

    const { result } = renderHook(() => usePdfImport());
    await act(async () => {
      await result.current.startImport();
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("a picked file lands on confirm with name/size/page info and a prefilled title", async () => {
    mockPickPdf.mockResolvedValue({
      uri: "file:///cache/DocumentPicker/7F9A2B1C-3D4E.pdf",
      name: "Symphony-No-5.pdf",
      size: 2_400_000,
    });

    const { result } = renderHook(() => usePdfImport());
    await act(async () => {
      await result.current.startImport();
    });

    expect(result.current.state).toBe("confirm");
    expect(result.current.fileName).toBe("Symphony-No-5.pdf");
    expect(result.current.fileSizeBytes).toBe(2_400_000);
    expect(result.current.pageCount).toBe(4);
    expect(result.current.defaultTitle).toBe("Symphony No 5");
    expect(result.current.sectionTitles).toEqual([]); // not yet confirmed
    expect(mockReadFileAsBase64).toHaveBeenCalledWith(
      "file:///cache/DocumentPicker/7F9A2B1C-3D4E.pdf",
    );
  });

  it("confirmImport uses the edited title and moves to uploading", async () => {
    mockPickPdf.mockResolvedValue({ uri: "file:///x.pdf", name: "raw-name.pdf", size: null });

    const { result } = renderHook(() => usePdfImport());
    await act(async () => {
      await result.current.startImport();
    });
    act(() => {
      result.current.confirmImport("Wait For Me");
    });

    expect(result.current.state).toBe("uploading");
    expect(result.current.sectionTitles).toEqual(["Wait For Me"]);
    expect(result.current.pdfB64).toBe("pdfBase64");
  });

  it("confirmImport with a blank title falls back to the file name", async () => {
    mockPickPdf.mockResolvedValue({ uri: "file:///x.pdf", name: "MyScore.pdf", size: null });

    const { result } = renderHook(() => usePdfImport());
    await act(async () => {
      await result.current.startImport();
    });
    act(() => {
      result.current.confirmImport("   ");
    });

    expect(result.current.sectionTitles).toEqual(["MyScore"]);
  });

  it("confirmImport before any pick is a no-op", () => {
    const { result } = renderHook(() => usePdfImport());
    act(() => {
      result.current.confirmImport("Nope");
    });
    expect(result.current.state).toBe("idle");
    expect(result.current.sectionTitles).toEqual([]);
  });

  it("read failure lands on error", async () => {
    mockPickPdf.mockResolvedValue({ uri: "file:///x.pdf", name: "x.pdf", size: null });
    mockReadFileAsBase64.mockRejectedValue(new Error("disk full"));

    const { result } = renderHook(() => usePdfImport());
    await act(async () => {
      await result.current.startImport();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe("disk full");
  });

  it("reset returns to idle and clears everything", async () => {
    mockPickPdf.mockResolvedValue({ uri: "file:///t.pdf", name: "test.pdf", size: 10 });

    const { result } = renderHook(() => usePdfImport());
    await act(async () => {
      await result.current.startImport();
    });
    act(() => {
      result.current.confirmImport("t");
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.pdfB64).toBeNull();
    expect(result.current.fileName).toBeNull();
    expect(result.current.pageCount).toBeNull();
    expect(result.current.sectionTitles).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
