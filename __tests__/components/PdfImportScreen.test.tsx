import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

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

// ── PageThumbnailGrid ─────────────────────────────────────────────────────────
jest.mock("../../client/components/PageThumbnailGrid", () => ({
  PageThumbnailGrid: () => null,
}));

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
  error: null,
  startImport: jest.fn(),
  setPageRanges: jest.fn(),
  setSectionTitle: jest.fn(),
  proceedToNaming: jest.fn(),
  reset: jest.fn(),
};

const idleMultiJobsHook = {
  overallStatus: "idle" as const,
  jobs: [],
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

describe("PdfImportScreen", () => {
  it("1. idle state renders Import PDF button", () => {
    const { getByText } = render(<PdfImportScreen />);
    expect(getByText("Import PDF")).toBeTruthy();
  });

  it("2. naming state renders text inputs for each section title", () => {
    mockUsePdfImport.mockReturnValue({
      ...idlePdfHook,
      state: "naming",
      pageRanges: [[1, 3], [4, 6]],
      sectionTitles: ["Section 1", "Section 2"],
    });

    const { getAllByDisplayValue } = render(<PdfImportScreen />);
    expect(getAllByDisplayValue(/Section/)).toHaveLength(2);
  });

  it("3. running state renders progress rows for each job", () => {
    mockUsePdfImport.mockReturnValue({ ...idlePdfHook, state: "naming" });
    mockUseMultiOmrJobs.mockReturnValue({
      ...idleMultiJobsHook,
      overallStatus: "running",
      jobs: [
        { title: "Act 1", status: "processing" },
        { title: "Act 2", status: "queued" },
      ],
    });

    const { getByText } = render(<PdfImportScreen />);
    expect(getByText("Act 1")).toBeTruthy();
    expect(getByText("Act 2")).toBeTruthy();
  });

  it("4. done state renders View Library button", () => {
    mockUsePdfImport.mockReturnValue({ ...idlePdfHook, state: "naming" });
    mockUseMultiOmrJobs.mockReturnValue({
      ...idleMultiJobsHook,
      overallStatus: "done",
      jobs: [{ title: "Act 1", status: "done", musicXmlUri: "file:///x.xml" }],
    });

    const { getByText } = render(<PdfImportScreen />);
    expect(getByText(/View Library/i)).toBeTruthy();
  });

  it("5. pressing Import PDF calls startImport", () => {
    const startImport = jest.fn();
    mockUsePdfImport.mockReturnValue({ ...idlePdfHook, startImport });

    const { getByText } = render(<PdfImportScreen />);
    fireEvent.press(getByText("Import PDF"));
    expect(startImport).toHaveBeenCalledTimes(1);
  });
});
