import React from "react";
import { render } from "@testing-library/react-native";

// ── Navigation ───────────────────────────────────────────────────────────────
const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
}));

// ── Safe area ────────────────────────────────────────────────────────────────
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

// ── Theme ─────────────────────────────────────────────────────────────────────
jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#333",
      textSecondary: "#888",
      primary: "#2563EB",
      primaryDark: "#1D4ED8",
      surface: "#F8F9FA",
      backgroundDefault: "#FFF",
      error: "#DC2626",
      warning: "#D97706",
      buttonText: "#FFF",
      success: "#16A34A",
      borderLight: "#F3F4F6",
    },
  }),
}));

// ── PracticeContext ───────────────────────────────────────────────────────────
jest.mock("../../client/context/PracticeContext", () => ({
  usePractice: jest.fn(),
}));

// ── usePdfImport ──────────────────────────────────────────────────────────────
jest.mock("../../client/hooks/usePdfImport", () => ({
  usePdfImport: jest.fn(),
}));

// ── useMultiOmrJobs ───────────────────────────────────────────────────────────
jest.mock("../../client/hooks/useMultiOmrJobs", () => ({
  useMultiOmrJobs: jest.fn(),
}));

// ── LoadingOverlay ────────────────────────────────────────────────────────────
jest.mock("../../client/components/LoadingOverlay", () => {
  const { View, Text } = require("react-native");
  return {
    LoadingOverlay: ({ message, subMessage }: any) => (
      <View testID="loading-overlay">
        <Text>{message}</Text>
        {subMessage && <Text>{subMessage}</Text>}
      </View>
    ),
  };
});

// ── Import after mocks ────────────────────────────────────────────────────────
import PdfImportScreen from "../../client/screens/PdfImportScreen";
import { usePdfImport } from "../../client/hooks/usePdfImport";
import { useMultiOmrJobs } from "../../client/hooks/useMultiOmrJobs";
import { usePractice } from "../../client/context/PracticeContext";

const mockUsePdfImport = usePdfImport as jest.Mock;
const mockUseMultiOmrJobs = useMultiOmrJobs as jest.Mock;
const mockUsePractice = usePractice as jest.Mock;

// ── Default hook states ───────────────────────────────────────────────────────
const idlePdfHook = {
  state: "idle" as const,
  chunks: [],
  sectionTitles: [],
  pdfB64: null,
  fileName: null,
  error: null,
  startImport: jest.fn(),
  reset: jest.fn(),
};

const idleMultiJobsHook = {
  overallStatus: "idle" as const,
  jobs: [],
  error: null,
  isSubmitting: false,
  submitAll: jest.fn(),
  retry: jest.fn(),
  reset: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUsePdfImport.mockReturnValue({ ...idlePdfHook, startImport: jest.fn() });
  mockUseMultiOmrJobs.mockReturnValue({ ...idleMultiJobsHook });
  mockUsePractice.mockReturnValue({
    addSheet: jest.fn().mockResolvedValue({ id: "s1" }),
    patchSheet: jest.fn().mockResolvedValue(undefined),
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PdfImportScreen — non-blocking import", () => {
  it("1. auto-starts import on mount", () => {
    const startImport = jest.fn();
    mockUsePdfImport.mockReturnValue({ ...idlePdfHook, startImport });
    render(<PdfImportScreen />);
    expect(startImport).toHaveBeenCalledTimes(1);
  });

  it("2. uploading state renders LoadingOverlay", () => {
    mockUsePdfImport.mockReturnValue({
      ...idlePdfHook,
      state: "uploading",
      fileName: "test.pdf",
    });
    mockUseMultiOmrJobs.mockReturnValue({
      ...idleMultiJobsHook,
      overallStatus: "uploading",
    });

    const { getByTestId } = render(<PdfImportScreen />);
    expect(getByTestId("loading-overlay")).toBeTruthy();
  });

  it("3. once jobs are running, returns to the library immediately", () => {
    mockUsePdfImport.mockReturnValue({
      ...idlePdfHook,
      state: "uploading",
      sectionTitles: ["Score"],
    });
    mockUseMultiOmrJobs.mockReturnValue({
      ...idleMultiJobsHook,
      overallStatus: "running",
      jobs: [
        {
          title: "Score",
          status: "processing" as const,
          pageRange: null,
          progressPercent: 5,
        },
      ],
    });

    render(<PdfImportScreen />);
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("4. submitAll receives lifecycle callbacks (queued/failed/progress)", () => {
    const submitAll = jest.fn();
    mockUsePdfImport.mockReturnValue({
      ...idlePdfHook,
      state: "uploading",
      pdfB64: "base64data",
      sectionTitles: ["Score"],
    });
    mockUseMultiOmrJobs.mockReturnValue({
      ...idleMultiJobsHook,
      overallStatus: "idle",
      submitAll,
    });

    render(<PdfImportScreen />);

    expect(submitAll).toHaveBeenCalledTimes(1);
    const lifecycle = submitAll.mock.calls[0][3];
    expect(typeof lifecycle.onJobQueued).toBe("function");
    expect(typeof lifecycle.onJobFailed).toBe("function");
    expect(typeof lifecycle.onJobProgress).toBe("function");
  });

  it("5. onJobProgress patches the persisted sheet's omrProgress", async () => {
    const patchSheet = jest.fn().mockResolvedValue(undefined);
    const addSheet = jest.fn().mockResolvedValue({ id: "sheet-1" });
    mockUsePractice.mockReturnValue({ addSheet, patchSheet });

    const submitAll = jest.fn();
    mockUsePdfImport.mockReturnValue({
      ...idlePdfHook,
      state: "uploading",
      pdfB64: "base64data",
      sectionTitles: ["Score"],
    });
    mockUseMultiOmrJobs.mockReturnValue({
      ...idleMultiJobsHook,
      overallStatus: "idle",
      submitAll,
    });

    render(<PdfImportScreen />);

    const lifecycle = submitAll.mock.calls[0][3];
    await lifecycle.onJobQueued(0, "job-1");
    expect(addSheet).toHaveBeenCalledWith(
      expect.objectContaining({ omrStatus: "processing", omrJobId: "job-1", omrProgress: 0 }),
    );

    lifecycle.onJobProgress(0, 42);
    expect(patchSheet).toHaveBeenCalledWith("sheet-1", { omrProgress: 42 });
  });

  it("6. error state renders Retry Upload button for upload errors", () => {
    mockUsePdfImport.mockReturnValue({
      ...idlePdfHook,
      state: "error",
      error: "Network error",
    });
    mockUseMultiOmrJobs.mockReturnValue({
      ...idleMultiJobsHook,
      overallStatus: "idle",
    });

    const { getByText } = render(<PdfImportScreen />);
    expect(getByText(/Retry Upload/i)).toBeTruthy();
  });

  it("7. OMR submit failure shows the error message", () => {
    mockUsePdfImport.mockReturnValue({
      ...idlePdfHook,
      state: "idle",
    });
    mockUseMultiOmrJobs.mockReturnValue({
      ...idleMultiJobsHook,
      overallStatus: "failed",
      error: "Network: Connection timeout",
      jobs: [
        {
          title: "Score",
          status: "failed" as const,
          pageRange: null,
          progressPercent: 50,
          error: "Network: Connection timeout",
        },
      ],
    });

    const { getByText } = render(<PdfImportScreen />);
    expect(getByText(/Network: Connection timeout/i)).toBeTruthy();
  });
});
