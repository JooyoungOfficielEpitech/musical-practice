import React from "react";
import { render } from "@testing-library/react-native";
import { CentsIndicator } from "../../client/components/CentsIndicator";

// Mock useTheme
jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      textSecondary: "#888888",
      success: "#6BA368",
      warning: "#FFA94D",
      error: "#FF6B6B",
      borderLight: "#FFE8F0",
    },
  }),
}));

// Mock react-native-reanimated
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: {
      View,
    },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (fn: () => object) => fn(),
    withSpring: (val: number) => val,
  };
});

describe("CentsIndicator", () => {
  it("renders cents value with sign for positive cents", () => {
    const { getByText } = render(<CentsIndicator cents={15} />);

    expect(getByText("+15¢")).toBeTruthy();
  });

  it("renders cents value without sign for negative cents", () => {
    const { getByText } = render(<CentsIndicator cents={-20} />);

    expect(getByText("-20¢")).toBeTruthy();
  });

  it("renders 0 cents as '0¢' (no sign)", () => {
    const { getByText } = render(<CentsIndicator cents={0} />);

    expect(getByText("0¢")).toBeTruthy();
  });

  it("renders Flat and Sharp labels", () => {
    const { getByText } = render(<CentsIndicator cents={0} />);

    expect(getByText("Flat")).toBeTruthy();
    expect(getByText("Sharp")).toBeTruthy();
  });

  it("rounds cents to nearest integer", () => {
    const { getByText } = render(<CentsIndicator cents={14.7} />);

    expect(getByText("+15¢")).toBeTruthy();
  });

  it("clamps display to maxCents boundary", () => {
    // The clamping happens in the animation position, not the display value.
    // The display shows the raw cents value (rounded).
    const { getByText } = render(<CentsIndicator cents={80} maxCents={50} />);

    // Display still shows the raw rounded value
    expect(getByText("+80¢")).toBeTruthy();
  });

  it("accepts custom maxCents prop", () => {
    // Should render without error
    const { getByText } = render(<CentsIndicator cents={30} maxCents={100} />);

    expect(getByText("+30¢")).toBeTruthy();
  });
});
