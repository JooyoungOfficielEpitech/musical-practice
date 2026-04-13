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

// -- Mock Supabase with N controllable Realtime channels --
// Each call to supabase.channel() gets its own callback captured in order.
const capturedCallbacks: Array<(payload: { new: Record<string, unknown> }) => void> = [];
const mockUnsubscribe = jest.fn();
const mockSubscribe = jest.fn().mockReturnValue({ unsubscribe: mockUnsubscribe });
const mockOn = jest.fn();
const mockChannel = jest.fn();

jest.mock("../../../client/lib/supabase", () => ({
  supabase: { channel: (...args: unknown[]) => mockChannel(...args) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  capturedCallbacks.length = 0;

  mockOn.mockImplementation(
    (_event: unknown, _filter: unknown, cb: (payload: { new: Record<string, unknown> }) => void) => {
      capturedCallbacks.push(cb);
      return { on: mockOn, subscribe: mockSubscribe };
    },
  );
  mockSubscribe.mockReturnValue({ unsubscribe: mockUnsubscribe });
  mockChannel.mockReturnValue({ on: mockOn, subscribe: mockSubscribe });
});

import { useMultiOmrJobs } from "../../../client/hooks/useMultiOmrJobs";
import type { SectionInput } from "../../../client/hooks/useMultiOmrJobs";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fireJobDone(callbackIndex: number, resultPath = "results/job.xml") {
  capturedCallbacks[callbackIndex]({ new: { status: "done", result_storage_path: resultPath } });
}

function fireJobFailed(callbackIndex: number, error = "OMR failed") {
  capturedCallbacks[callbackIndex]({ new: { status: "failed", error } });
}

function fireJobProcessing(callbackIndex: number, jobId = "job-x") {
  capturedCallbacks[callbackIndex]({ new: { status: "processing", id: jobId } });
}

const section1: SectionInput = { pageRange: [1, 3], title: "Act 1" };
const section2: SectionInput = { pageRange: [4, 7], title: "Act 2" };

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

  it("3. single section happy path: done → onJobDone(0, uri) → overallStatus done", async () => {
    mockUploadPdf.mockResolvedValue("storage/path.pdf");
    mockSubmitJob.mockResolvedValue("job-1");
    mockDownloadResult.mockResolvedValue("file:///musicxml/s0.musicxml");

    const onJobDone = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMultiOmrJobs());

    await act(async () => {
      result.current.submitAll("pdfB64==", [section1], onJobDone);
      await Promise.resolve();
    });

    // Realtime fires "done" for job 0
    await act(async () => {
      fireJobDone(0, "results/job-1.xml");
      await Promise.resolve();
    });

    expect(mockDownloadResult).toHaveBeenCalledWith("results/job-1.xml", expect.any(String));
    expect(onJobDone).toHaveBeenCalledWith(0, "file:///musicxml/s0.musicxml");
    expect(result.current.jobs[0].status).toBe("done");
    expect(result.current.jobs[0].musicXmlUri).toBe("file:///musicxml/s0.musicxml");
    expect(result.current.overallStatus).toBe("done");
  });

  it("4. two sections both complete → onJobDone called twice → overallStatus done", async () => {
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
      fireJobDone(0, "results/job-1.xml");
      await Promise.resolve();
    });

    await act(async () => {
      fireJobDone(1, "results/job-2.xml");
      await Promise.resolve();
    });

    expect(onJobDone).toHaveBeenCalledTimes(2);
    expect(onJobDone).toHaveBeenNthCalledWith(1, 0, "file:///musicxml/s0.musicxml");
    expect(onJobDone).toHaveBeenNthCalledWith(2, 1, "file:///musicxml/s1.musicxml");
    expect(result.current.jobs[0].status).toBe("done");
    expect(result.current.jobs[1].status).toBe("done");
    expect(result.current.overallStatus).toBe("done");
  });

  it("5. two sections, one fails → overallStatus failed, onJobDone called once", async () => {
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
      fireJobDone(0, "results/job-1.xml");
      await Promise.resolve();
    });

    await act(async () => {
      fireJobFailed(1, "OMR timed out");
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
});
