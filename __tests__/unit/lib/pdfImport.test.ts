import { pickPdf, readFileAsBase64, fetchPdfChunks, defaultTitles } from "../../../client/lib/pdfImport";
import type { PageRange } from "../../../client/lib/pdfImport";

import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock("expo-file-system", () => ({
  File: jest.fn(),
  Directory: jest.fn(),
  Paths: { document: "" },
}));

global.fetch = jest.fn();

const mockGetDocumentAsync = DocumentPicker.getDocumentAsync as jest.Mock;
const MockFile = File as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("pickPdf", () => {
  it("returns null when user cancels", async () => {
    mockGetDocumentAsync.mockResolvedValue({ canceled: true });

    const result = await pickPdf();

    expect(result).toBeNull();
  });

  it("returns uri string when user selects file", async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///test.pdf" }],
    });

    const result = await pickPdf();

    expect(result).toBe("file:///test.pdf");
  });
});

describe("readFileAsBase64", () => {
  it("returns base64 string from file", async () => {
    const mockFileInstance = {
      base64: jest.fn().mockReturnValue("bW9ja0Jhc2U2NA=="),
    };
    MockFile.mockImplementation(() => mockFileInstance);

    const result = await readFileAsBase64("file:///test.pdf");

    expect(result).toBe("bW9ja0Jhc2U2NA==");
    expect(MockFile).toHaveBeenCalledWith("file:///test.pdf");
  });
});

describe("fetchPdfChunks", () => {
  it("calls fetch with correct URL and body shape", async () => {
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ chunks: [["abc"]] }),
    });

    const pageRanges: PageRange[] = [[1, 3]];
    await fetchPdfChunks("pdfBase64String", pageRanges);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.0.10:8000/pdf-chunks",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({ pdf_b64: "pdfBase64String", page_ranges: [[1, 3]] }),
      }),
    );
  });

  it("maps response to PdfChunksResult correctly", async () => {
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ chunks: [["abc", "def"], ["ghi"]] }),
    });

    const pageRanges: PageRange[] = [[1, 2], [3, 3]];
    const result = await fetchPdfChunks("pdfBase64String", pageRanges);

    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0].pngB64s).toEqual(["abc", "def"]);
    expect(result.chunks[0].pageRange).toEqual([1, 2]);
    expect(result.chunks[1].pngB64s).toEqual(["ghi"]);
    expect(result.chunks[1].pageRange).toEqual([3, 3]);
  });

  it("maps empty pageRanges with generated page ranges from response", async () => {
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ chunks: [["abc"], ["def"]] }),
    });

    const result = await fetchPdfChunks("pdfBase64String", []);

    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0].pngB64s).toEqual(["abc"]);
    expect(result.chunks[1].pngB64s).toEqual(["def"]);
  });

  it("throws on non-ok response", async () => {
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
    });

    await expect(fetchPdfChunks("pdfBase64String", [])).rejects.toThrow("422");
  });
});

describe("defaultTitles", () => {
  it("generates N titles with base name and 1-based section numbers", () => {
    expect(defaultTitles(3, "Les Mis")).toEqual([
      "Les Mis — Section 1",
      "Les Mis — Section 2",
      "Les Mis — Section 3",
    ]);
  });

  it("generates a single title for count = 1", () => {
    expect(defaultTitles(1, "Hamilton")).toEqual(["Hamilton — Section 1"]);
  });

  it("returns empty array for count = 0", () => {
    expect(defaultTitles(0, "Anything")).toEqual([]);
  });
});
