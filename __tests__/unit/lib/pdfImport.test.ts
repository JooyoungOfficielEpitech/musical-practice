import { pickPdf, readFileAsBase64 } from "../../../client/lib/pdfImport";

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

  it("returns uri and the original document name when user selects file", async () => {
    // copyToCacheDirectory renames the file to a UUID — the human name only
    // exists in asset.name, so pickPdf must surface both.
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///cache/DocumentPicker/7F9A2B1C-3D4E.pdf",
          name: "Hermes - Full Score.pdf",
        },
      ],
    });

    const result = await pickPdf();

    expect(result).toEqual({
      uri: "file:///cache/DocumentPicker/7F9A2B1C-3D4E.pdf",
      name: "Hermes - Full Score.pdf",
    });
  });

  it("falls back to the uri filename when asset.name is missing", async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///cache/some-file.pdf" }],
    });

    const result = await pickPdf();

    expect(result).toEqual({
      uri: "file:///cache/some-file.pdf",
      name: "some-file.pdf",
    });
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
