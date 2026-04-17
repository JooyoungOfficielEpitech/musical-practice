import React from "react";
import { render } from "@testing-library/react-native";
import { PitchStrip } from "../../client/components/PitchStrip";

// Mock useTheme
jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#333333",
      textSecondary: "#888888",
      success: "#16A34A",
      successLight: "rgba(22,163,74,0.09)",
      warning: "#F59E0B",
      warningLight: "rgba(245,158,11,0.09)",
      error: "#DC2626",
      errorLight: "rgba(220,38,38,0.09)",
      surface: "#F8F9FA",
      borderLight: "#F3F4F6",
      primary: "#2563EB",
    },
    isDark: false,
  }),
}));

// Mock reanimated
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (v: number) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: number) => v,
  };
});

describe("PitchStrip", () => {
  const defaultProps = {
    currentPitch: null,
    isListening: false,
    accuracy: 0,
  };

  it("renders with testID", () => {
    const { getByTestId } = render(<PitchStrip {...defaultProps} />);
    expect(getByTestId("pitch-strip")).toBeTruthy();
  });

  it("shows placeholder when no pitch detected", () => {
    const { getByText } = render(<PitchStrip {...defaultProps} isListening />);
    expect(getByText("--")).toBeTruthy();
  });

  it("shows note name and octave when pitch is detected", () => {
    const { getByText } = render(
      <PitchStrip
        currentPitch={{ note: "A", octave: 4, cents: 3 }}
        isListening
        accuracy={87}
      />,
    );
    expect(getByText("A4")).toBeTruthy();
  });

  it("shows In Tune label when cents is within threshold", () => {
    const { getByText } = render(
      <PitchStrip
        currentPitch={{ note: "A", octave: 4, cents: 5 }}
        isListening
        accuracy={90}
      />,
    );
    expect(getByText("In Tune")).toBeTruthy();
  });

  it("shows Sharp label when cents is positive beyond threshold", () => {
    const { getByText } = render(
      <PitchStrip
        currentPitch={{ note: "A", octave: 4, cents: 30 }}
        isListening
        accuracy={60}
      />,
    );
    expect(getByText("Sharp")).toBeTruthy();
  });

  it("shows Flat label when cents is negative beyond threshold", () => {
    const { getByText } = render(
      <PitchStrip
        currentPitch={{ note: "B", octave: 3, cents: -30 }}
        isListening
        accuracy={55}
      />,
    );
    expect(getByText("Flat")).toBeTruthy();
  });

  it("shows accuracy percentage", () => {
    const { getByText } = render(
      <PitchStrip
        currentPitch={{ note: "C", octave: 5, cents: 0 }}
        isListening
        accuracy={87}
      />,
    );
    expect(getByText("87%")).toBeTruthy();
  });

  it("shows cents value", () => {
    const { getByText } = render(
      <PitchStrip
        currentPitch={{ note: "D", octave: 4, cents: 12 }}
        isListening
        accuracy={75}
      />,
    );
    expect(getByText("+12¢")).toBeTruthy();
  });

  it("does not show pitch info when not listening", () => {
    const { queryByText } = render(
      <PitchStrip
        currentPitch={{ note: "A", octave: 4, cents: 0 }}
        isListening={false}
        accuracy={50}
      />,
    );
    expect(queryByText("A4")).toBeNull();
  });
});
