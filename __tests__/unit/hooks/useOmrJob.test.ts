import { renderHook, act } from "@testing-library/react-native";

// -- Mock omrQueue lib --
const mockUploadPdf = jest.fn();
const mockSubmitJob = jest.fn();
const mockDownloadResult = jest.fn();

jest.mock("../../../client/lib/omrQueue", () => ({
  OmrQueueError: class OmrQueueError extends Error {},
  uploadPdfToStorage: (...args: unknown[]) => mockUploadPdf(...args),
  submitOmrJob: (...args: unknown[]) => mockSubmitJob(...args),
  downloadResult: (...args: unknown[]) => mockDownloadResult(...args),
}));

// -- Mock Supabase with controllable Realtime channel --
let capturedCallback: ((payload: { new: Record<string, unknown> }) => void) | null = null;
const mockUnsubscribe = jest.fn();
const mockSubscribe = jest.fn().mockReturnValue({ unsubscribe: mockUnsubscribe });
const mockOn = jest.fn().mockReturnThis();
const mockChannel = jest.fn().mockReturnValue({
  on: mockOn,
  subscribe: mockSubscribe,
});

jest.mock("../../../client/lib/supabase", () => ({
  supabase: { channel: (...args: unknown[]) => mockChannel(...args) },
}));

// Helper: capture the postgres_changes callback so tests can fire it manually
beforeEach(() => {
  jest.clearAllMocks();
  capturedCallback = null;
  mockOn.mockImplementation((_event: unknown, _filter: unknown, cb: (payload: { new: Record<string, unknown> }) => void) => {
    capturedCallback = cb;
    return { on: mockOn, subscribe: mockSubscribe };
  });
  mockSubscribe.mockReturnValue({ unsubscribe: mockUnsubscribe });
});

import { useOmrJob } from "../../../client/hooks/useOmrJob";

describe("useOmrJob", () => {
  it("initial state is idle", () => {
    const { result } = renderHook(() => useOmrJob());
    expect(result.current.state.status).toBe("idle");
  });

  it("submitJob transitions idle → submitting → queued on success", async () => {
    mockUploadPdf.mockResolvedValue("job-abc.pdf");
    mockSubmitJob.mockResolvedValue("job-abc");

    const { result } = renderHook(() => useOmrJob());

    await act(async () => {
      result.current.submitJob("pdfB64==", [[1, 2]], "sheet-1");
      await Promise.resolve();
    });

    expect(result.current.state.status).toBe("queued");
    if (result.current.state.status === "queued") {
      expect(result.current.state.jobId).toBe("job-abc");
    }
  });

  it("Realtime update with status processing → transitions to processing", async () => {
    mockUploadPdf.mockResolvedValue("job-abc.pdf");
    mockSubmitJob.mockResolvedValue("job-abc");

    const { result } = renderHook(() => useOmrJob());

    await act(async () => {
      result.current.submitJob("pdfB64==", [[1, 2]], "sheet-1");
      await Promise.resolve();
    });

    expect(capturedCallback).not.toBeNull();

    act(() => {
      capturedCallback!({ new: { id: "job-abc", status: "processing" } });
    });

    expect(result.current.state.status).toBe("processing");
  });

  it("Realtime update with status done → downloads result and transitions to done", async () => {
    mockUploadPdf.mockResolvedValue("job-abc.pdf");
    mockSubmitJob.mockResolvedValue("job-abc");
    mockDownloadResult.mockResolvedValue("file:///musicxml/sheet-1.musicxml");

    const { result } = renderHook(() => useOmrJob());

    await act(async () => {
      result.current.submitJob("pdfB64==", [[1, 2]], "sheet-1");
      await Promise.resolve();
    });

    await act(async () => {
      capturedCallback!({ new: { id: "job-abc", status: "done", result_storage_path: "job-abc.musicxml" } });
      await Promise.resolve();
    });

    expect(mockDownloadResult).toHaveBeenCalledWith("job-abc.musicxml", "sheet-1");
    expect(result.current.state.status).toBe("done");
    if (result.current.state.status === "done") {
      expect(result.current.state.musicXmlUri).toBe("file:///musicxml/sheet-1.musicxml");
    }
  });

  it("Realtime update with status failed → transitions to failed with error", async () => {
    mockUploadPdf.mockResolvedValue("job-abc.pdf");
    mockSubmitJob.mockResolvedValue("job-abc");

    const { result } = renderHook(() => useOmrJob());

    await act(async () => {
      result.current.submitJob("pdfB64==", [[1, 2]], "sheet-1");
      await Promise.resolve();
    });

    act(() => {
      capturedCallback!({ new: { id: "job-abc", status: "failed", error: "OMR failed" } });
    });

    expect(result.current.state.status).toBe("failed");
    if (result.current.state.status === "failed") {
      expect(result.current.state.error).toBe("OMR failed");
    }
  });

  it("submitJob → transitions to failed on OmrQueueError", async () => {
    const { OmrQueueError } = jest.requireActual("../../../client/lib/omrQueue") as { OmrQueueError: new (msg: string) => Error };
    mockUploadPdf.mockRejectedValue(new OmrQueueError("Supabase not configured"));

    const { result } = renderHook(() => useOmrJob());

    await act(async () => {
      result.current.submitJob("pdfB64==", [[1, 2]], "sheet-1");
      await Promise.resolve();
    });

    expect(result.current.state.status).toBe("failed");
  });

  it("reset returns state to idle", async () => {
    mockUploadPdf.mockResolvedValue("job-abc.pdf");
    mockSubmitJob.mockResolvedValue("job-abc");

    const { result } = renderHook(() => useOmrJob());

    await act(async () => {
      result.current.submitJob("pdfB64==", [[1, 2]], "sheet-1");
      await Promise.resolve();
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.status).toBe("idle");
  });
});
