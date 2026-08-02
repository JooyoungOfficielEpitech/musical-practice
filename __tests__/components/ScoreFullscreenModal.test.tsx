import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { ScoreFullscreenModal } from "../../client/components/ScoreFullscreenModal";

jest.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#000", textSecondary: "#666", primary: "#2563EB",
      backgroundDefault: "#FFF", surface: "#F8F9FA", buttonText: "#FFF",
    },
  }),
}));

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View };
});
jest.mock("../../client/components/InteractiveScore", () => ({ InteractiveScore: () => null }));

const mockLockAsync = jest.fn().mockResolvedValue(undefined);
jest.mock("expo-screen-orientation", () => ({
  lockAsync: (...args: unknown[]) => mockLockAsync(...args),
  OrientationLock: { PORTRAIT_UP: "PORTRAIT_UP", LANDSCAPE: "LANDSCAPE" },
}));

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    visible: true,
    onClose: jest.fn(),
    musicXml: "<score/>",
    positionMs: 0,
    isPlaying: false,
    onPlayPause: jest.fn(),
    ...overrides,
  };
}

describe("ScoreFullscreenModal — landscape toggle", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders a rotate button and locks to landscape on press", async () => {
    const { getByLabelText } = render(<ScoreFullscreenModal {...(makeProps() as any)} />);
    await act(async () => {
      fireEvent.press(getByLabelText("Rotate to landscape"));
    });
    expect(mockLockAsync).toHaveBeenCalledWith("LANDSCAPE");
  });

  it("locks back to portrait when toggled again", async () => {
    const { getByLabelText } = render(<ScoreFullscreenModal {...(makeProps() as any)} />);
    await act(async () => {
      fireEvent.press(getByLabelText("Rotate to landscape"));
    });
    await act(async () => {
      fireEvent.press(getByLabelText("Rotate to portrait"));
    });
    expect(mockLockAsync).toHaveBeenLastCalledWith("PORTRAIT_UP");
  });

  it("restores portrait when the modal closes while in landscape", async () => {
    const props = makeProps();
    const { getByLabelText, rerender } = render(<ScoreFullscreenModal {...(props as any)} />);
    await act(async () => {
      fireEvent.press(getByLabelText("Rotate to landscape"));
    });
    mockLockAsync.mockClear();

    await act(async () => {
      rerender(<ScoreFullscreenModal {...({ ...props, visible: false } as any)} />);
    });
    expect(mockLockAsync).toHaveBeenCalledWith("PORTRAIT_UP");
  });
});
