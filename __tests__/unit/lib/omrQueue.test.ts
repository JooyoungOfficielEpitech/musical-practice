/**
 * Tests for client/lib/omrQueue.ts
 * Verifies upload, submit, and download operations against a mocked Supabase client.
 */

// Must be set before importing omrQueue (module-level singleton)
const mockUpload = jest.fn();
const mockDownload = jest.fn();
const mockInsert = jest.fn();
const MOCK_USER_ID = "user-uuid-123";

jest.mock("../../../client/lib/supabase", () => ({
  supabase: {
    auth: {
      // Hardcoded — jest.mock is hoisted before const declarations
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-uuid-123" } }, error: null }),
    },
    storage: {
      from: jest.fn((bucket: string) => ({
        upload: mockUpload,
        download: mockDownload,
      })),
    },
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: mockInsert,
        })),
      })),
    })),
  },
}));

// FileReader polyfill for Node.js test environment
global.FileReader = class {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsText(blob: Blob) {
    blob.text().then((text) => {
      this.result = text;
      this.onload?.();
    }).catch(() => this.onerror?.());
  }
} as unknown as typeof FileReader;

jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation(() => ({
    write: jest.fn(),
    uri: "file:///mock/musicxml/job-123.musicxml",
  })),
  Directory: jest.fn().mockImplementation(() => ({
    exists: false,
    create: jest.fn(),
  })),
  Paths: { document: "file:///mock" },
}));

import {
  OmrQueueError,
  uploadPdfToStorage,
  submitOmrJob,
  downloadResult,
} from "../../../client/lib/omrQueue";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("uploadPdfToStorage", () => {
  it("calls storage.from(omr-pdfs).upload with correct path and data", async () => {
    mockUpload.mockResolvedValue({ data: { path: `omr-pdfs/${MOCK_USER_ID}/job-abc.pdf` }, error: null });
    // btoa("pdf") = "cGRm" — valid base64
    const result = await uploadPdfToStorage("cGRm", "job-abc");
    expect(mockUpload).toHaveBeenCalledWith(
      `${MOCK_USER_ID}/job-abc.pdf`,
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: "application/pdf" }),
    );
    expect(result).toBe(`${MOCK_USER_ID}/job-abc.pdf`);
  });

  it("throws OmrQueueError when upload fails", async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: "upload failed" } });
    await expect(uploadPdfToStorage("cGRm", "job-x")).rejects.toBeInstanceOf(OmrQueueError);
  });
});

describe("submitOmrJob", () => {
  it("inserts a row with status pending and returns job id", async () => {
    mockInsert.mockResolvedValue({
      data: { id: "job-abc", status: "pending" },
      error: null,
    });
    const id = await submitOmrJob("job-abc.pdf", [[1, 2]]);
    expect(id).toBe("job-abc");
    expect(mockInsert).toHaveBeenCalled();
  });

  it("throws OmrQueueError on insert error", async () => {
    mockInsert.mockResolvedValue({ data: null, error: { message: "insert failed" } });
    await expect(submitOmrJob("job-abc.pdf", [])).rejects.toBeInstanceOf(OmrQueueError);
  });
});

describe("downloadResult", () => {
  it("downloads from omr-results bucket and returns local URI", async () => {
    mockDownload.mockResolvedValue({ data: new Blob(["<xml/>"]), error: null });
    const uri = await downloadResult("job-abc.musicxml", "sheet-1");
    expect(mockDownload).toHaveBeenCalledWith("job-abc.musicxml");
    expect(typeof uri).toBe("string");
  });

  it("throws OmrQueueError on download failure", async () => {
    mockDownload.mockResolvedValue({ data: null, error: { message: "not found" } });
    await expect(downloadResult("missing.musicxml", "sheet-1")).rejects.toBeInstanceOf(OmrQueueError);
  });
});

describe("OmrQueueError", () => {
  it("is an instance of Error", () => {
    const err = new OmrQueueError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("test");
  });
});
