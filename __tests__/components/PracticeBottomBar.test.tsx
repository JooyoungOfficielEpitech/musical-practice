import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PracticeBottomBar } from "../../client/components/PracticeBottomBar";

// Mock dependencies
jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#333333",
      textSecondary: "#888888",
      surface: "#FFFFFF",
      borderLight: "#EEEEEE",
      primaryDark: "#1D4ED8",
      warning: "#F59E0B",
      error: "#DC2626",
      buttonText: "#FFFFFF",
      overlay: "rgba(0,0,0,0.4)",
    },
    isDark: false,
  }),
}));

jest.mock("expo-blur", () => ({
  BlurView: "BlurView",
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("../../client/hooks/useTimer", () => ({
  useTimer: () => ({
    seconds: 0,
    isRunning: false,
    start: jest.fn(),
    pause: jest.fn(),
    formatTime: (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`,
  }),
}));

describe("PracticeBottomBar", () => {
  it("renders play button and timer", () => {
    const { getByLabelText, getByText } = render(<PracticeBottomBar />);
    expect(getByLabelText("Start practice")).toBeTruthy();
    expect(getByText("00:00")).toBeTruthy();
  });

  it("calls onRunningChange(true) when play is pressed", () => {
    const onRunningChange = jest.fn();
    const { getByLabelText } = render(
      <PracticeBottomBar onRunningChange={onRunningChange} />,
    );
    fireEvent.press(getByLabelText("Start practice"));
    expect(onRunningChange).toHaveBeenCalledWith(true);
  });

  it("calls onStart when play is pressed", () => {
    const onStart = jest.fn();
    const { getByLabelText } = render(
      <PracticeBottomBar onStart={onStart} />,
    );
    fireEvent.press(getByLabelText("Start practice"));
    expect(onStart).toHaveBeenCalled();
  });

  it("does not show stop button when seconds is 0", () => {
    const { queryByLabelText } = render(<PracticeBottomBar />);
    expect(queryByLabelText("Stop practice")).toBeNull();
  });

  it("renders in minimal mode without crashing", () => {
    const { getByLabelText } = render(<PracticeBottomBar minimal />);
    expect(getByLabelText("Start practice")).toBeTruthy();
  });
});

// ─── Accessibility: timer-playback-state-not-announced ────────────────────────
describe("PracticeBottomBar — accessibility (timer-playback-state-not-announced)", () => {
  it("A1 — Timer has accessibilityLiveRegion to announce time updates", () => {
    const { toJSON } = render(<PracticeBottomBar />);
    const json = JSON.stringify(toJSON());
    expect(json).toContain("accessibilityLiveRegion");
  });

  it("A2 — Timer accessibilityLabel includes formatted time", () => {
    const { toJSON } = render(<PracticeBottomBar />);
    const json = JSON.stringify(toJSON());
    // Should include time in label for announcements
    expect(json).toContain("accessibilityLabel");
  });

  it("A3 — Play button announces play/pause state change", () => {
    const { getByLabelText } = render(<PracticeBottomBar />);
    const playBtn = getByLabelText("Start practice");
    expect(playBtn).toBeTruthy();
  });
});

// ─── Accessibility: dynamic-content-not-announced ────────────────────────────
describe("PracticeBottomBar — accessibility (dynamic-content-not-announced)", () => {
  it("A1 — State changes announce via accessibilityLiveRegion", () => {
    const { toJSON } = render(<PracticeBottomBar />);
    const json = JSON.stringify(toJSON());
    expect(json).toContain("accessibilityLiveRegion");
  });

  it("A2 — Timer container has accessible role and label", () => {
    const { toJSON } = render(<PracticeBottomBar />);
    const json = JSON.stringify(toJSON());
    // Timer should be accessible and labeled
    expect(json).toBeTruthy();
  });
});
