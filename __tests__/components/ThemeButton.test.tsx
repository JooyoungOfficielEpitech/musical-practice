import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ThemeButton } from "../../client/components/ThemeButton";

jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      primary: "#2563EB",
      error: "#DC2626",
      buttonText: "#FFFFFF",
      errorLight: "rgba(220,38,38,0.09)",
      primaryLight: "rgba(37,99,235,0.09)",
      textSecondary: "#6B7280",
    },
  }),
}));

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (fn: () => object) => fn(),
    withSpring: (val: number) => val,
  };
});

describe("ThemeButton", () => {
  it("renders label text", () => {
    const { getByText } = render(
      <ThemeButton label="Start" onPress={() => {}} />
    );
    expect(getByText("Start")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <ThemeButton label="Go" onPress={onPress} />
    );
    fireEvent.press(getByText("Go"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows ActivityIndicator when loading=true", () => {
    const { getByTestId, queryByText } = render(
      <ThemeButton label="Go" onPress={() => {}} loading={true} />
    );
    expect(getByTestId("theme-button-spinner")).toBeTruthy();
    expect(queryByText("Go")).toBeNull();
  });

  it("does not call onPress when disabled=true", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <ThemeButton label="Go" onPress={onPress} disabled={true} />
    );
    fireEvent.press(getByTestId("theme-button"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("applies primary variant by default", () => {
    const { getByTestId } = render(
      <ThemeButton label="Go" onPress={() => {}} />
    );
    const btn = getByTestId("theme-button");
    const style = btn.props.style;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flatStyle.backgroundColor).toBe("#2563EB");
  });

  it("applies danger variant background color", () => {
    const { getByTestId } = render(
      <ThemeButton label="Delete" onPress={() => {}} variant="danger" />
    );
    const btn = getByTestId("theme-button");
    const style = btn.props.style;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flatStyle.backgroundColor).toBe("#DC2626");
  });
});
