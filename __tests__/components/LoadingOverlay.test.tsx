import React from "react";
import { render } from "@testing-library/react-native";
import { LoadingOverlay } from "../../client/components/LoadingOverlay";

jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      primary: "#2563EB",
      text: "#1F2937",
      textSecondary: "#6B7280",
      backgroundDefault: "#FFFFFF",
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

// Mock ProgressTrack so LoadingOverlay tests are isolated
jest.mock("../../client/components/ProgressTrack", () => ({
  ProgressTrack: ({ percent }: { percent: number }) => {
    const { View } = require("react-native");
    return <View testID="progress-track-mock" accessibilityLabel={`${percent}`} />;
  },
}));

describe("LoadingOverlay", () => {
  it("renders message text", () => {
    const { getByText } = render(
      <LoadingOverlay message="Importing file…" />
    );
    expect(getByText("Importing file…")).toBeTruthy();
  });

  it("renders subMessage when provided", () => {
    const { getByText } = render(
      <LoadingOverlay message="Uploading…" subMessage="Connecting to server…" />
    );
    expect(getByText("Connecting to server…")).toBeTruthy();
  });

  it("does not render subMessage when not provided", () => {
    const { queryByTestId } = render(
      <LoadingOverlay message="Uploading…" />
    );
    expect(queryByTestId("loading-overlay-submessage")).toBeNull();
  });

  it("always renders ActivityIndicator", () => {
    const { getByTestId } = render(
      <LoadingOverlay message="Loading…" />
    );
    expect(getByTestId("loading-overlay-spinner")).toBeTruthy();
  });

  it("does NOT render ProgressTrack when progress prop not provided", () => {
    const { queryByTestId } = render(
      <LoadingOverlay message="Loading…" />
    );
    expect(queryByTestId("progress-track-mock")).toBeNull();
  });

  it("renders ProgressTrack with correct percent when progress prop provided", () => {
    const { getByTestId } = render(
      <LoadingOverlay message="Loading…" progress={75} />
    );
    const track = getByTestId("progress-track-mock");
    expect(track.props.accessibilityLabel).toBe("75");
  });

  it("renders ProgressTrack at 0% when progress=0", () => {
    const { getByTestId } = render(
      <LoadingOverlay message="Starting…" progress={0} />
    );
    const track = getByTestId("progress-track-mock");
    expect(track.props.accessibilityLabel).toBe("0");
  });
});
