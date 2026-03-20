import React from "react";
import { render } from "@testing-library/react-native";
import { FloatingPitchPanel } from "../../client/components/FloatingPitchPanel";
import type { PitchResult } from "../../client/lib/audio/types";

// Mock useTheme
jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#333333",
      textSecondary: "#888888",
      primary: "#2563EB",
      primaryDark: "#1D4ED8",
      primaryLight: "rgba(37,99,235,0.09)",
      success: "#16A34A",
      successLight: "rgba(22,163,74,0.09)",
      warning: "#F59E0B",
      warningSubtle: "rgba(245,158,11,0.09)",
      error: "#DC2626",
      errorLight: "rgba(220,38,38,0.09)",
      backgroundSecondary: "#F8F9FA",
      borderLight: "#F3F4F6",
      surface: "#F8F9FA",
      buttonText: "#FFFFFF",
      overlay: "rgba(0,0,0,0.4)",
      ripple: "rgba(0,0,0,0.1)",
      rippleLight: "rgba(255,255,255,0.3)",
    },
    isDark: false,
  }),
}));

// Mock expo-blur
jest.mock("expo-blur", () => ({
  BlurView: "BlurView",
}));

// Mock reanimated
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: {
      View: View,
      createAnimatedComponent: (c: any) => c,
    },
    useSharedValue: (v: any) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: any) => v,
    runOnJS: (fn: any) => fn,
  };
});

// Mock gesture handler
jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  return {
    GestureDetector: ({ children }: any) => children,
    GestureHandlerRootView: View,
    Gesture: {
      Pan: () => ({
        onStart: function () { return this; },
        onUpdate: function () { return this; },
        onEnd: function () { return this; },
      }),
    },
  };
});

// Mock @expo/vector-icons
jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

// Mock expo-haptics
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
}));

// Mock react-native-svg
jest.mock("react-native-svg", () => {
  const { View, Text } = require("react-native");
  return {
    __esModule: true,
    default: View,
    Svg: View,
    Line: View,
    Ellipse: (props: any) => <View testID={props.testID} />,
    Text: Text,
    G: View,
  };
});

const makePitch = (overrides: Partial<PitchResult> = {}): PitchResult => ({
  frequency: 440,
  note: "A",
  octave: 4,
  cents: 0,
  clarity: 0.95,
  ...overrides,
});

describe("FloatingPitchPanel", () => {
  const defaultProps = {
    isListening: false,
    currentPitch: null,
    accuracy: 0,
    isRecording: false,
    currentBpm: 120,
    onBpmChange: jest.fn(),
  };

  it("renders without crashing", () => {
    const { toJSON } = render(<FloatingPitchPanel {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it("shows Pitch and Met tab labels when expanded", () => {
    const { getByText } = render(<FloatingPitchPanel {...defaultProps} />);
    expect(getByText("Pitch")).toBeTruthy();
    expect(getByText("Met")).toBeTruthy();
  });

  it("shows note name when listening with pitch", () => {
    const { getAllByText } = render(
      <FloatingPitchPanel
        {...defaultProps}
        isListening={true}
        currentPitch={makePitch({ note: "C", octave: 4 })}
      />,
    );
    expect(getAllByText("C4").length).toBeGreaterThanOrEqual(1);
  });

  it("shows In Tune label when cents is within threshold", () => {
    const { getAllByText } = render(
      <FloatingPitchPanel
        {...defaultProps}
        isListening={true}
        currentPitch={makePitch({ cents: 5 })}
      />,
    );
    expect(getAllByText("In Tune").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Sharp label when cents is positive beyond threshold", () => {
    const { getAllByText } = render(
      <FloatingPitchPanel
        {...defaultProps}
        isListening={true}
        currentPitch={makePitch({ cents: 30 })}
      />,
    );
    expect(getAllByText("Sharp").length).toBeGreaterThanOrEqual(1);
  });

  it("shows REC badge when recording", () => {
    const { getByText } = render(
      <FloatingPitchPanel
        {...defaultProps}
        isListening={true}
        currentPitch={makePitch()}
        isRecording={true}
      />,
    );
    expect(getByText("REC")).toBeTruthy();
  });

  it("does not show REC badge when not recording", () => {
    const { queryByText } = render(
      <FloatingPitchPanel
        {...defaultProps}
        isListening={true}
        currentPitch={makePitch()}
        isRecording={false}
      />,
    );
    expect(queryByText("REC")).toBeNull();
  });
});
