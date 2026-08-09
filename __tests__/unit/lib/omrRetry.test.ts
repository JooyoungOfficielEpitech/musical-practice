/**
 * Tests for client/lib/omrRetry.ts
 * Re-submitting a failed OMR job by cloning its pdf path + page ranges into a
 * fresh job row, and building the sheet patch that restarts tracking.
 */

const MOCK_USER_ID = "user-uuid-123";

const mockGetUser = jest.fn();
const mockSignInAnonymously = jest.fn();
const mockSelectSingle = jest.fn();
const mockInsertSingle = jest.fn();
const mockInsert = jest.fn((_payload?: unknown) => ({
  select: jest.fn(() => ({ single: mockInsertSingle })),
}));
const mockEq = jest.fn(() => ({ single: mockSelectSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));

jest.mock("../../../client/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
    },
    from: jest.fn(() => ({
      select: () => mockSelect(),
      insert: (payload: unknown) => mockInsert(payload),
    })),
  },
}));

import { resubmitOmrJob, buildRetryPatch, OmrRetryError } from "../../../client/lib/omrRetry";
import type { SheetMusic } from "../../../client/lib/storage";

function makeSheet(overrides: Partial<SheetMusic> = {}): SheetMusic {
  return {
    id: "sheet-1",
    title: "Test",
    artist: "",
    imageUris: [],
    createdAt: 0,
    folder: "",
    isFavorite: false,
    omrStatus: "failed",
    omrJobId: "old-job-id",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: MOCK_USER_ID } } });
  mockSelectSingle.mockResolvedValue({
    data: { pdf_storage_path: "user/x.pdf", page_ranges: [[1, 3]] },
    error: null,
  });
  mockInsertSingle.mockResolvedValue({ data: { id: "new-job-id" }, error: null });
});

describe("resubmitOmrJob", () => {
  it("clones pdf path and page ranges from the old job into a new row", async () => {
    const newId = await resubmitOmrJob("old-job-id");

    expect(newId).toBe("new-job-id");
    expect(mockEq).toHaveBeenCalledWith("id", "old-job-id");
    expect(mockInsert).toHaveBeenCalledWith({
      pdf_storage_path: "user/x.pdf",
      page_ranges: [[1, 3]],
      user_id: MOCK_USER_ID,
    });
  });

  it("throws when the old job row cannot be read", async () => {
    mockSelectSingle.mockResolvedValue({ data: null, error: { message: "gone" } });
    await expect(resubmitOmrJob("old-job-id")).rejects.toThrow(OmrRetryError);
  });

  it("throws when the insert fails", async () => {
    mockInsertSingle.mockResolvedValue({ data: null, error: { message: "nope" } });
    await expect(resubmitOmrJob("old-job-id")).rejects.toThrow(OmrRetryError);
  });
});

describe("buildRetryPatch", () => {
  it("returns a patch that flips the sheet back to processing with the new job id", async () => {
    const patch = await buildRetryPatch(makeSheet());
    expect(patch).toEqual({
      omrJobId: "new-job-id",
      omrStatus: "processing",
      omrProgress: 0,
      hasLocalEdits: false,
    });
  });

  it("throws when the sheet has no job id to retry", async () => {
    await expect(buildRetryPatch(makeSheet({ omrJobId: undefined }))).rejects.toThrow(
      OmrRetryError,
    );
  });
});
