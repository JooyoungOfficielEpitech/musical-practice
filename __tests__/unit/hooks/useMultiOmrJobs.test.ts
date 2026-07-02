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

// -- Mock Supabase with Realtime channel pattern --
const capturedCallbacks: Array<(payload: { new: Record<string, unknown> }) => void> = [];
const mockUnsubscribe = jest.fn();
const mockSubscribe = jest.fn().mockReturnValue({ unsubscribe: mockUnsubscribe });
const mockOn = jest.fn().mockImplementation((_event: unknown, _filter: unknown, cb: (payload: { new: Record<string, unknown> }) => void) => {
  capturedCallbacks.push(cb);
  return { on: mockOn, subscribe: mockSubscribe };
});
const mockChannel = jest.fn().mockReturnValue({ on: mockOn, subscribe: mockSubscribe });

jest.mock("../../../client/lib/supabase", () => ({
  supabase: { channel: (...args: unknown[]) => mockChannel(...args) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  capturedCallbacks.length = 0;
  mockOn.mockImplementation((_event: unknown, _filter: unknown, cb: (payload: { new: Record<string, unknown> }) => void) => {
    capturedCallbacks.push(cb);
    return { on: mockOn, subscribe: mockSubscribe };
  });
  mockChannel.mockReturnValue({ on: mockOn, subscribe: mockSubscribe });
  mockSubscribe.mockReturnValue({ unsubscribe: mockUnsubscribe });
});

import { useMultiOmrJobs } from "../../../client/hooks/useMultiOmrJobs";
import type { SectionInput } from "../../../client/hooks/useMultiOmrJobs";

const section1: SectionInput = { pageRange: [1, 3], title: "Act 1" };
const section2: SectionInput = { pageRange: [4, 7], title: "Act 2" };

// -- Helpers to fire Realtime events --
function fireUpdate(idx: number, patch: Record<string, unknown>): void {
  capturedCallbacks[idx]({ new: patch });
}
function fireProcessing(idx: number, pct = 0): void {
  fireUpdate(idx, { status: "processing", progress_percent: pct, result_storage_path: null, error: null });
}
function fireDone(idx: number, resultPath = "results/job.xml"): void {
  fireUpdate(idx, { status: "done", progress_percent: 100, result_storage_path: resultPath, error: null });
}
function fireFailed(idx: number, error = "OMR failed"): void {
  fireUpdate(idx, { status: "failed", progress_percent: 0, result_storage_path: null, error });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useMultiOmrJobs", () => {
  it("1. initial state: overallStatus idle, jobs empty", () => {
    const { result } = renderHook(() => useMultiOmrJobs());
    expect(result.current.overallStatus).toBe("idle");
    expect(result.current.jobs).toEqual([]);
  });

  it("2. upload failure → overallStatus failed, onJobDone never called", async () => {
    mockUploadPdf.mockRejectedValue(new Error("network error"));

    const onJobDone = jest.fn();
    const { result } = renderHook(() => useMultiOmrJobs());

    await act(async () => {
      result.current.submitAll("pdfB64==", [section1], onJobDone);
      await Promise.resolve();
    });

    expect(result.current.overallStatus).toBe("failed");
    expect(onJobDone).not.toHaveBeenCalled();
  });

  it("3. single section: Realtime fires 'done' → onJobDone(0, uri) → overallStatus done", async () => {
    mockUploadPdf.mockResolvedValue("storage/path.pdf");
    mockSubmitJob.mockResolvedValue("job-1");
    mockDownloadResult.mockResolvedValue("file:///musicxml/s0.musicxml");

    const onJobDone = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMultiOmrJobs());

    await act(async () => {
      result.current.submitAll("pdfB64==", [section1], onJobDone);
      await Promise.resolve();
    });

    await act(async () => {
      fireDone(0, "results/job-1.xml");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockDownloadResult).toHaveBeenCalledWith("results/job-1.xml", expect.any(String));
    expect(onJobDone).toHaveBeenCalledWith(0, "file:///musicxml/s0.musicxml", "results/job-1.xml");
    expect(result.current.jobs[0].status).toBe("done");
    expect(result.current.jobs[0].musicXmlUri).toBe("file:///musicxml/s0.musicxml");
    expect(result.current.overallStatus).toBe("done");
  });

  it("4. two sections both Realtime 'done' → onJobDone called twice → overallStatus done", async () => {
    mockUploadPdf.mockResolvedValue("storage/path.pdf");
    mockSubmitJob
      .mockResolvedValueOnce("job-1")
      .mockResolvedValueOnce("job-2");
    mockDownloadResult
      .mockResolvedValueOnce("file:///musicxml/s0.musicxml")
      .mockResolvedValueOnce("file:///musicxml/s1.musicxml");

    const onJobDone = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMultiOmrJobs());

    await act(async () => {
      result.current.submitAll("pdfB64==", [section1, section2], onJobDone);
      await Promise.resolve();
    });

    await act(async () => {
      fireDone(0, "results/job-1.xml");
      fireDone(1, "results/job-2.xml");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onJobDone).toHaveBeenCalledTimes(2);
    expect(result.current.jobs[0].status).toBe("done");
    expect(result.current.jobs[1].status).toBe("done");
    expect(result.current.overallStatus).toBe("done");
  });

  it("5. two sections, one Realtime 'done' one 'failed' → overallStatus failed, onJobDone called once", async () => {
    mockUploadPdf.mockResolvedValue("storage/path.pdf");
    mockSubmitJob
      .mockResolvedValueOnce("job-1")
      .mockResolvedValueOnce("job-2");
    mockDownloadResult.mockResolvedValue("file:///musicxml/s0.musicxml");

    const onJobDone = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMultiOmrJobs());

    await act(async () => {
      result.current.submitAll("pdfB64==", [section1, section2], onJobDone);
      await Promise.resolve();
    });

    await act(async () => {
      fireDone(0, "results/job-1.xml");
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      fireFailed(1, "OMR timed out");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onJobDone).toHaveBeenCalledTimes(1);
    expect(result.current.jobs[0].status).toBe("done");
    expect(result.current.jobs[1].status).toBe("failed");
    expect(result.current.jobs[1].error).toBe("OMR timed out");
    expect(result.current.overallStatus).toBe("failed");
  });

  it("6. reset() returns to idle and clears jobs", async () => {
    mockUploadPdf.mockResolvedValue("storage/path.pdf");
    mockSubmitJob.mockResolvedValue("job-1");

    const onJobDone = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMultiOmrJobs());

    await act(async () => {
      result.current.submitAll("pdfB64==", [section1], onJobDone);
      await Promise.resolve();
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.overallStatus).toBe("idle");
    expect(result.current.jobs).toEqual([]);
  });

  it("7. pageRange is populated from SectionInput after submitAll", async () => {
    mockUploadPdf.mockResolvedValue("storage/path.pdf");
    mockSubmitJob.mockResolvedValue("job-1");

    const onJobDone = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMultiOmrJobs());

    await act(async () => {
      result.current.submitAll("pdfB64==", [section1, section2], onJobDone);
      await Promise.resolve();
    });

    expect(result.current.jobs[0].pageRange).toEqual([1, 3]);
    expect(result.current.jobs[1].pageRange).toEqual([4, 7]);
  });

  it("8. startedAt is undefined before any Realtime event fires", async () => {
    mockUploadPdf.mockResolvedValue("storage/path.pdf");
    mockSubmitJob.mockResolvedValue("job-1");

    const onJobDone = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMultiOmrJobs());

    await act(async () => {
      result.current.submitAll("pdfB64==", [section1], onJobDone);
      await Promise.resolve();
    });

    expect(result.current.jobs[0].startedAt).toBeUndefined();
  });

  it("9. startedAt is set (epoch ms) when Realtime fires 'processing'", async () => {
    mockUploadPdf.mockResolvedValue("storage/path.pdf");
    mockSubmitJob.mockResolvedValue("job-1");

    const onJobDone = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMultiOmrJobs());

    await act(async () => {
      result.current.submitAll("pdfB64==", [section1], onJobDone);
      await Promise.resolve();
    });

    const before = Date.now();
    await act(async () => {
      fireProcessing(0, 0);
      await Promise.resolve();
    });
    const after = Date.now();

    expect(result.current.jobs[0].status).toBe("processing");
    expect(typeof result.current.jobs[0].startedAt).toBe("number");
    expect(result.current.jobs[0].startedAt).toBeGreaterThanOrEqual(before);
    expect(result.current.jobs[0].startedAt).toBeLessThanOrEqual(after);
  });

  it("10. progressPercent initialises to 0 after submitAll", async () => {
    mockUploadPdf.mockResolvedValue("storage/path.pdf");
    mockSubmitJob.mockResolvedValue("job-1");

    const onJobDone = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMultiOmrJobs());

    await act(async () => {
      result.current.submitAll("pdfB64==", [section1], onJobDone);
      await Promise.resolve();
    });

    expect(result.current.jobs[0].progressPercent).toBe(0);
  });

  it("11. Realtime fires progress_percent: 45 → jobs[0].progressPercent === 45", async () => {
    mockUploadPdf.mockResolvedValue("storage/path.pdf");
    mockSubmitJob.mockResolvedValue("job-1");

    const onJobDone = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMultiOmrJobs());

    await act(async () => {
      result.current.submitAll("pdfB64==", [section1], onJobDone);
      await Promise.resolve();
    });

    await act(async () => {
      fireProcessing(0, 45);
      await Promise.resolve();
    });

    expect(result.current.jobs[0].progressPercent).toBe(45);
  });

  it("12. Realtime fires 'done' → jobs[0].progressPercent === 100", async () => {
    mockUploadPdf.mockResolvedValue("storage/path.pdf");
    mockSubmitJob.mockResolvedValue("job-1");
    mockDownloadResult.mockResolvedValue("file:///musicxml/s0.musicxml");

    const onJobDone = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMultiOmrJobs());

    await act(async () => {
      result.current.submitAll("pdfB64==", [section1], onJobDone);
      await Promise.resolve();
    });

    await act(async () => {
      fireDone(0, "results/job-1.xml");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.jobs[0].progressPercent).toBe(100);
  });

  it("13. retry(index) resets failed job to queued and resubmits", async () => {
    mockUploadPdf.mockResolvedValue("storage/path.pdf");
    mockSubmitJob
      .mockResolvedValueOnce("job-1")
      .mockResolvedValueOnce("job-1-retry");
    mockDownloadResult.mockResolvedValue("file:///musicxml/s0.musicxml");

    const onJobDone = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMultiOmrJobs());

    await act(async () => {
      result.current.submitAll("pdfB64==", [section1], onJobDone);
      await Promise.resolve();
    });

    await act(async () => {
      fireFailed(0, "OMR timeout");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.jobs[0].status).toBe("failed");
    expect(result.current.jobs[0].error).toBe("OMR timeout");

    // Now retry
    mockSubmitJob.mockResolvedValueOnce("job-1-retry");
    await act(async () => {
      result.current.retry(0);
      await Promise.resolve();
    });

    expect(result.current.jobs[0].status).toBe("queued");
    expect(result.current.jobs[0].error).toBeUndefined();
    expect(mockSubmitJob).toHaveBeenCalledTimes(2);
  });
});
