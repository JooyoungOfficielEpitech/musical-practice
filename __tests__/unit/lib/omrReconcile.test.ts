const mockSingle = jest.fn();
const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

jest.mock("../../../client/lib/supabase", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

const mockDownloadResult = jest.fn();
jest.mock("../../../client/lib/omrQueue", () => ({
  downloadResult: (...args: unknown[]) => mockDownloadResult(...args),
}));

import { reconcileOmrSheet } from "../../../client/lib/omrReconcile";
import type { SheetMusic } from "../../../client/lib/storage";

const baseSheet: SheetMusic = {
  id: "sheet-1",
  title: "Hermes",
  artist: "",
  imageUris: [],
  createdAt: 0,
  folder: "Musical",
  isFavorite: false,
  omrStatus: "processing",
  omrJobId: "job-1",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
});

describe("reconcileOmrSheet", () => {
  it("returns a ready patch (with downloaded uri) when the job is done", async () => {
    mockSingle.mockResolvedValue({
      data: { status: "done", progress_percent: 100, result_storage_path: "user/job-1.musicxml", error: null },
      error: null,
    });
    mockDownloadResult.mockResolvedValue("file:///musicxml/sheet-1.musicxml");

    const patch = await reconcileOmrSheet(baseSheet);

    expect(mockDownloadResult).toHaveBeenCalledWith("user/job-1.musicxml", "sheet-1");
    expect(patch).toEqual({
      musicXmlUri: "file:///musicxml/sheet-1.musicxml",
      resultStoragePath: "user/job-1.musicxml",
      omrStatus: "ready",
      omrProgress: 100,
    });
  });

  it("returns a failed patch when the job failed", async () => {
    mockSingle.mockResolvedValue({
      data: { status: "failed", progress_percent: 10, result_storage_path: null, error: "boom" },
      error: null,
    });

    const patch = await reconcileOmrSheet(baseSheet);

    expect(patch).toEqual({ omrStatus: "failed" });
  });

  it("returns a progress patch while running when the percent moved", async () => {
    mockSingle.mockResolvedValue({
      data: { status: "processing", progress_percent: 37, result_storage_path: null, error: null },
      error: null,
    });

    expect(await reconcileOmrSheet({ ...baseSheet, omrProgress: 20 })).toEqual({
      omrProgress: 37,
    });
  });

  it("returns null while running when the percent is unchanged", async () => {
    mockSingle.mockResolvedValue({
      data: { status: "processing", progress_percent: 37, result_storage_path: null, error: null },
      error: null,
    });

    expect(await reconcileOmrSheet({ ...baseSheet, omrProgress: 37 })).toBeNull();
  });

  it("returns null when the sheet has no job id or is not processing", async () => {
    expect(await reconcileOmrSheet({ ...baseSheet, omrJobId: undefined })).toBeNull();
    expect(await reconcileOmrSheet({ ...baseSheet, omrStatus: "ready" })).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns null when the job row query errors", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "gone" } });

    expect(await reconcileOmrSheet(baseSheet)).toBeNull();
  });
});
