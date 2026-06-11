import React from "react";
import { render, within } from "@testing-library/react-native";

// ── Navigation ───────────────────────────────────────────────────────────────
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
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

// ── ProgressTrack ────────────────────────────────────────────────────────────
jest.mock("../../client/components/ProgressTrack", () => {
  const { View } = require("react-native");
  return {
    ProgressTrack: ({ percent }: any) => <View testID="progress-track" style={{ width: `${percent}%` }} />,
  };
});

// ── JobRowItem ────────────────────────────────────────────────────────────────
jest.mock("../../client/components/JobRowItem", () => {
  const { View, Text } = require("react-native");
  return {
    JobRowItem: ({ job }: any) => (
      <View testID={`job-row-${job.title}`}>
        <Text>{job.title}</Text>
        <Text>{job.status}</Text>
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
  pageRanges: [],
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
  submitAll: jest.fn(),
  reset: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUsePdfImport.mockReturnValue({ ...idlePdfHook, startImport: jest.fn() });
  mockUseMultiOmrJobs.mockReturnValue({ ...idleMultiJobsHook });
  mockUsePractice.mockReturnValue({ addSheet: jest.fn().mockResolvedValue({ id: "s1" }) });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PdfImportScreen — Phase 2: 1-tap PDF import", () => {
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

  it("3. running state renders LoadingOverlay with progress", () => {
    mockUsePdfImport.mockReturnValue({
      ...idlePdfHook,
      state: "idle",
      sectionTitles: ["Score"],
    });
    mockUseMultiOmrJobs.mockReturnValue({
      ...idleMultiJobsHook,
      overallStatus: "running",
      jobs: [
        {
          title: "Score",
          status: "processing" as const,
          pageRange: [1, 12] as [number, number],
          progressPercent: 45,
        },
      ],
    });

    const { getByTestId } = render(<PdfImportScreen />);
    expect(getByTestId("loading-overlay")).toBeTruthy();
  });

  it("4. done state renders View Library button", () => {
    mockUsePdfImport.mockReturnValue({
      ...idlePdfHook,
      state: "idle",
    });
    mockUseMultiOmrJobs.mockReturnValue({
      ...idleMultiJobsHook,
      overallStatus: "done",
      jobs: [
        {
          title: "Score",
          status: "done" as const,
          pageRange: [1, 12] as [number, number],
          progressPercent: 100,
          musicXmlUri: "file:///x.xml",
        },
      ],
    });

    const { getByText } = render(<PdfImportScreen />);
    expect(getByText(/View Library/i)).toBeTruthy();
  });

  it("5. error state renders Retry Upload button for upload errors", () => {
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

  it("6. does NOT render TextInput for naming", () => {
    mockUsePdfImport.mockReturnValue({
      ...idlePdfHook,
      state: "uploading",
      sectionTitles: ["Score"],
    });

    const { UNSAFE_queryAllByType } = render(<PdfImportScreen />);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { TextInput } = require("react-native");
    expect(UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
  });

  it("7. does NOT render PageThumbnailGrid", () => {
    mockUsePdfImport.mockReturnValue({
      ...idlePdfHook,
      state: "uploading",
    });

    const { queryByTestId } = render(<PdfImportScreen />);
    expect(queryByTestId("page-thumbnail")).toBeNull();
  });
});
