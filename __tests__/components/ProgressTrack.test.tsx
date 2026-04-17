import React from "react";
import { render } from "@testing-library/react-native";
import { ProgressTrack } from "../../client/components/ProgressTrack";

jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      primary: "#2563EB",
      borderLight: "#F3F4F6",
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
    withTiming: (val: number) => val,
    withSpring: (val: number) => val,
  };
});

describe("ProgressTrack", () => {
  it("renders without crashing", () => {
    const { getByTestId } = render(<ProgressTrack percent={0} />);
    expect(getByTestId("progress-track")).toBeTruthy();
  });

  it("fill width reflects percent prop (50 → 50%)", () => {
    const { getByTestId } = render(<ProgressTrack percent={50} />);
    const fill = getByTestId("progress-track-fill");
    const style = fill.props.style;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flatStyle.width).toBe("50%");
  });

  it("fill width is 0% when percent=0", () => {
    const { getByTestId } = render(<ProgressTrack percent={0} />);
    const fill = getByTestId("progress-track-fill");
    const style = fill.props.style;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flatStyle.width).toBe("0%");
  });

  it("fill width is 100% when percent=100", () => {
    const { getByTestId } = render(<ProgressTrack percent={100} />);
    const fill = getByTestId("progress-track-fill");
    const style = fill.props.style;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flatStyle.width).toBe("100%");
  });

  it("uses default height 6 when height prop not provided", () => {
    const { getByTestId } = render(<ProgressTrack percent={50} />);
    const track = getByTestId("progress-track");
    const style = track.props.style;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flatStyle.height).toBe(6);
  });

  it("uses custom height when height prop is provided", () => {
    const { getByTestId } = render(<ProgressTrack percent={50} height={12} />);
    const track = getByTestId("progress-track");
    const style = track.props.style;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flatStyle.height).toBe(12);
  });

  it("uses colors.primary as default fill color", () => {
    const { getByTestId } = render(<ProgressTrack percent={50} />);
    const fill = getByTestId("progress-track-fill");
    const style = fill.props.style;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flatStyle.backgroundColor).toBe("#2563EB");
  });

  it("uses custom color when color prop is provided", () => {
    const { getByTestId } = render(
      <ProgressTrack percent={50} color="#16A34A" />
    );
    const fill = getByTestId("progress-track-fill");
    const style = fill.props.style;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flatStyle.backgroundColor).toBe("#16A34A");
  });
});
