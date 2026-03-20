import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { SheetFormModal } from "../../client/components/SheetFormModal";
import type { SheetMusic } from "../../client/lib/storage";

jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#1F2937",
      textSecondary: "#6B7280",
      primary: "#2563EB",
      primaryDark: "#1D4ED8",
      surface: "#F8F9FA",
      backgroundDefault: "#FFFFFF",
      backgroundSecondary: "#F8F9FA",
      borderLight: "#F3F4F6",
      buttonText: "#FFFFFF",
      success: "#16A34A",
      error: "#DC2626",
      overlay: "rgba(0,0,0,0.4)",
      primaryLight: "rgba(37, 99, 235, 0.09)",
      primarySubtle: "rgba(37, 99, 235, 0.19)",
    },
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  MediaTypeOptions: { Images: "Images" },
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-image", () => ({
  Image: "Image",
}));

function makeSheet(overrides: Partial<SheetMusic> = {}): SheetMusic {
  return {
    id: "1",
    title: "Test Song",
    artist: "Test Artist",
    imageUris: ["img1.jpg"],
    audioUri: "audio.mp3",
    createdAt: Date.now(),
    folder: "Musical",
    isFavorite: false,
    ...overrides,
  };
}

describe("SheetFormModal", () => {
  const onClose = jest.fn();
  const onSubmit = jest.fn();

  beforeEach(() => {
    onClose.mockClear();
    onSubmit.mockClear();
  });

  describe("create mode (no initialData)", () => {
    it("shows 'Add Score' title", () => {
      const { getByText } = render(
        <SheetFormModal visible={true} onClose={onClose} onSubmit={onSubmit} />,
      );
      expect(getByText("Add Score")).toBeTruthy();
    });

    it("shows 'Add to Library' button", () => {
      const { getByText } = render(
        <SheetFormModal visible={true} onClose={onClose} onSubmit={onSubmit} />,
      );
      expect(getByText("Add to Library")).toBeTruthy();
    });

    it("shows empty form fields", () => {
      const { queryByDisplayValue } = render(
        <SheetFormModal visible={true} onClose={onClose} onSubmit={onSubmit} />,
      );
      // title/artist should be empty
      expect(queryByDisplayValue("Test Song")).toBeNull();
    });
  });

  describe("edit mode (with initialData)", () => {
    it("shows 'Edit Score' title", () => {
      const sheet = makeSheet();
      const { getByText } = render(
        <SheetFormModal visible={true} onClose={onClose} onSubmit={onSubmit} initialData={sheet} />,
      );
      expect(getByText("Edit Score")).toBeTruthy();
    });

    it("shows 'Save Changes' button", () => {
      const sheet = makeSheet();
      const { getByText } = render(
        <SheetFormModal visible={true} onClose={onClose} onSubmit={onSubmit} initialData={sheet} />,
      );
      expect(getByText("Save Changes")).toBeTruthy();
    });

    it("pre-fills form with existing data", () => {
      const sheet = makeSheet({ title: "My Song", artist: "My Artist" });
      const { getByDisplayValue } = render(
        <SheetFormModal visible={true} onClose={onClose} onSubmit={onSubmit} initialData={sheet} />,
      );
      expect(getByDisplayValue("My Song")).toBeTruthy();
      expect(getByDisplayValue("My Artist")).toBeTruthy();
    });

    it("shows existing image count", () => {
      const sheet = makeSheet({ imageUris: ["a.jpg", "b.jpg", "c.jpg"] });
      const { getByText } = render(
        <SheetFormModal visible={true} onClose={onClose} onSubmit={onSubmit} initialData={sheet} />,
      );
      expect(getByText("3 images")).toBeTruthy();
    });

    it("shows audio attached indicator when MR exists", () => {
      const sheet = makeSheet({ audioUri: "track.mp3" });
      const { getByText } = render(
        <SheetFormModal visible={true} onClose={onClose} onSubmit={onSubmit} initialData={sheet} />,
      );
      expect(getByText("Audio attached")).toBeTruthy();
    });

    it("shows Select MP3 when no MR", () => {
      const sheet = makeSheet({ audioUri: undefined });
      const { getByText } = render(
        <SheetFormModal visible={true} onClose={onClose} onSubmit={onSubmit} initialData={sheet} />,
      );
      expect(getByText("Select MP3")).toBeTruthy();
    });
  });

  it("calls onClose when close button pressed", () => {
    const { getByLabelText } = render(
      <SheetFormModal visible={true} onClose={onClose} onSubmit={onSubmit} />,
    );
    fireEvent.press(getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
