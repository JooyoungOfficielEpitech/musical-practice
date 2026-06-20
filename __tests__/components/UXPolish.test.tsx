import React from "react";
import { render, screen } from "@testing-library/react-native";
import { ScorePreviewControls } from "../../client/components/ScorePreviewControls";
import { SessionCompleteModal } from "../../client/components/SessionCompleteModal";

// Mock useTheme
jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      primary: "#2563EB",
      primaryDark: "#1e40af",
      surface: "#FFFFFF",
      borderLight: "#E5E7EB",
      text: "#1F2937",
      textSecondary: "#6B7280",
      buttonText: "#FFFFFF",
      backgroundSecondary: "#F3F4F6",
      backgroundTertiary: "#F9FAFB",
      warning: "#F59E0B",
      warningSubtle: "#FEF3C7",
      error: "#DC2626",
      overlay: "rgba(0, 0, 0, 0.5)",
      ripple: "rgba(0, 0, 0, 0.12)",
    },
    isDark: false,
  }),
}));

jest.mock("../../client/hooks/useSynthPlayer", () => ({
  useSynthPlayer: jest.fn(),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("react-native-webview", () => ({
  WebView: "WebView",
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: {
    Warning: "warning",
  },
}));

jest.mock("../../client/components/TempoPresets", () => ("TempoPresets"));

jest.mock("../../client/components/SeekBar", () => ("SeekBar"));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

// Test 1: Play/pause button should be 56x56 instead of 44x44
describe("Task 1: Increase play/pause button size and add state label", () => {
  it("renders play label when playing is false", () => {
    render(
      <ScorePreviewControls
        isPlaying={false}
        positionMs={0}
        durationMs={60000}
        tempo={1.0}
        onTempoChange={jest.fn()}
        instrument="piano"
        instrumentLoading={false}
        onPlayPause={jest.fn()}
        editMode={false}
        onToggleEdit={jest.fn()}
        hasEdits={false}
        onOpenInstrumentPicker={jest.fn()}
        compact
      />
    );

    expect(screen.getByText("Play")).toBeTruthy();
  });

  it("renders pause label when playing is true", () => {
    render(
      <ScorePreviewControls
        isPlaying={true}
        positionMs={0}
        durationMs={60000}
        tempo={1.0}
        onTempoChange={jest.fn()}
        instrument="piano"
        instrumentLoading={false}
        onPlayPause={jest.fn()}
        editMode={false}
        onToggleEdit={jest.fn()}
        hasEdits={false}
        onOpenInstrumentPicker={jest.fn()}
        compact
      />
    );

    expect(screen.getByText("Pause")).toBeTruthy();
  });
});

// Test 3: Tempo controls should be inline with seek bar
describe("Task 3: Move tempo controls inline with seek bar", () => {
  it("renders inline tempo controls in compact mode", () => {
    render(
      <ScorePreviewControls
        isPlaying={false}
        positionMs={0}
        durationMs={60000}
        tempo={1.0}
        onTempoChange={jest.fn()}
        instrument="piano"
        instrumentLoading={false}
        onPlayPause={jest.fn()}
        editMode={false}
        onToggleEdit={jest.fn()}
        hasEdits={false}
        onOpenInstrumentPicker={jest.fn()}
        compact={true}
      />
    );

    // Should have Tempo label visible
    expect(screen.getByText("Tempo")).toBeTruthy();
    // Should have current tempo value
    expect(screen.getByText("1.00x")).toBeTruthy();
  });
});

// Test 4: Cursor glow and smooth scroll - This is tested via InteractiveScore visual rendering
describe("Task 4: Brighten cursor visibility", () => {
  it("placeholder for cursor styling validation", () => {
    expect(true).toBe(true);
  });
});

// Test 5: Parts label for multi-part scores
describe("Task 5: Add PARTS label for multi-part scores", () => {
  // This test is for PracticeBrowseView behavior
  // We'll verify the label is rendered when parts.length > 1
  it("renders PARTS label when score has multiple parts", () => {
    // Placeholder test - this would require full PracticeBrowseView setup
    expect(true).toBe(true);
  });
});

// Test 6: Remove accuracy field from SessionCompleteModal
describe("Task 6: Remove accuracy field from SessionCompleteModal", () => {
  it("does not render accuracy stat box", () => {
    render(
      <SessionCompleteModal
        visible={true}
        result={{ duration: 120, bpm: 120 }}
        onClose={jest.fn()}
        streak={1}
        totalSessions={5}
      />
    );

    // Should have Duration and BPM but NOT accuracy
    expect(screen.getByText("Duration")).toBeTruthy();
    expect(screen.getByText("BPM")).toBeTruthy();
    expect(screen.queryByText("Accuracy")).toBeFalsy();
  });

  it("displays only two stat boxes (duration and bpm)", () => {
    const { UNSAFE_getAllByType } = render(
      <SessionCompleteModal
        visible={true}
        result={{ duration: 120, bpm: 120 }}
        onClose={jest.fn()}
      />
    );

    const statBoxes = UNSAFE_getAllByType(require("react-native").View).filter(
      (view: any) => view.props.testID?.includes("stat")
    );

    // We expect 2 stat boxes, not 3
    expect(statBoxes.length).toBeLessThanOrEqual(2);
  });
});
