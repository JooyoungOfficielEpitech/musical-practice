import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert, ActionSheetIOS, Platform } from "react-native";

// ── Navigation ────────────────────────────────────────────────────────────────
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

// ── Safe area ─────────────────────────────────────────────────────────────────
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

// ── Theme ──────────────────────────────────────────────────────────────────────
jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#333", textSecondary: "#888", primary: "#2563EB", primaryDark: "#1D4ED8",
      surface: "#F8F9FA", backgroundDefault: "#FFF", borderLight: "#F3F4F6",
      buttonText: "#FFF", error: "#DC2626",
    },
  }),
}));

// ── Haptics ───────────────────────────────────────────────────────────────────
jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

// ── PracticeContext ────────────────────────────────────────────────────────────
jest.mock("../../client/context/PracticeContext", () => ({
  usePractice: jest.fn(),
}));

// ── practiceCardUtils ─────────────────────────────────────────────────────────
jest.mock("../../client/lib/practiceCardUtils", () => ({
  getLastSession: jest.fn(() => null),
  getLastAccuracy: jest.fn(() => null),
}));

// ── SheetCard ─────────────────────────────────────────────────────────────────
jest.mock("../../client/components/SheetCard", () => ({
  SheetCard: () => null,
}));

// ── SheetFormModal ────────────────────────────────────────────────────────────
jest.mock("../../client/components/SheetFormModal", () => ({
  SheetFormModal: () => null,
}));

// ── ConfirmModal ──────────────────────────────────────────────────────────────
jest.mock("../../client/components/ConfirmModal", () => ({
  ConfirmModal: () => null,
}));

import LibraryScreen from "../../client/screens/LibraryScreen";
import { usePractice } from "../../client/context/PracticeContext";

const mockUsePractice = usePractice as jest.Mock;

const defaultPracticeContext = {
  sheets: [],
  sessions: [],
  addSheet: jest.fn(),
  removeSheet: jest.fn(),
  stats: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUsePractice.mockReturnValue(defaultPracticeContext);
  // Default platform to iOS for ActionSheetIOS tests
  Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
});

describe("LibraryScreen — filter visibility", () => {
  it("hides genre filter chips when filtered.length === 0", () => {
    mockUsePractice.mockReturnValue({
      ...defaultPracticeContext,
      sheets: [],
    });

    const { queryByText } = render(<LibraryScreen />);

    // When library is empty, filter chips should not be rendered
    expect(queryByText("All")).toBeNull();
    expect(queryByText("Classical")).toBeNull();
    expect(queryByText("Jazz")).toBeNull();
  });

  it("shows genre filter chips when filtered.length > 0", () => {
    mockUsePractice.mockReturnValue({
      ...defaultPracticeContext,
      sheets: [
        {
          id: "1",
          title: "Test Score",
          artist: "Test Artist",
          folder: "All",
          createdAt: new Date().toISOString(),
          favorite: false,
        },
      ],
    });

    const { getByText } = render(<LibraryScreen />);

    // When library has content, filter chips should be visible
    expect(getByText("All")).toBeDefined();
    expect(getByText("Classical")).toBeDefined();
  });
});

describe("LibraryScreen — + button entry point", () => {
  it("1. pressing + on iOS shows action sheet with Add Score and Import PDF", () => {
    const spy = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation(() => {});

    const { getByLabelText } = render(<LibraryScreen />);
    fireEvent.press(getByLabelText("Add new score"));

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.arrayContaining(["Add Score", "Import PDF"]),
      }),
      expect.any(Function),
    );
  });

  it("2. choosing Import PDF from action sheet navigates to PdfImport", () => {
    let capturedCallback: ((index: number) => void) | null = null;
    jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation(
      (options, callback) => {
        capturedCallback = callback;
      },
    );

    const { getByLabelText } = render(<LibraryScreen />);
    fireEvent.press(getByLabelText("Add new score"));

    // Find index of "Import PDF" in options
    const options = (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mock.calls[0][0].options as string[];
    const importIndex = options.indexOf("Import PDF");
    capturedCallback!(importIndex);

    expect(mockNavigate).toHaveBeenCalledWith("PdfImport");
  });

  it("3. on Android, pressing + shows Alert with Add Score and Import PDF buttons", () => {
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
    const alertSpy = jest.spyOn(Alert, "alert");

    const { getByLabelText } = render(<LibraryScreen />);
    fireEvent.press(getByLabelText("Add new score"));

    expect(alertSpy).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      expect.arrayContaining([
        expect.objectContaining({ text: "Add Score" }),
        expect.objectContaining({ text: "Import PDF" }),
      ]),
    );
  });
});
