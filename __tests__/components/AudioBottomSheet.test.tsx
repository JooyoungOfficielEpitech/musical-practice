import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { AudioBottomSheet } from "../../client/components/AudioBottomSheet";

jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#333", textSecondary: "#888", primary: "#2563EB",
      backgroundDefault: "#FFF", surface: "#F8F9FA", backgroundSecondary: "#F8F9FA",
      borderLight: "#F3F4F6", buttonText: "#FFF", error: "#DC2626",
    },
  }),
}));

jest.mock("../../client/hooks/useAudioPlayer", () => ({
  useAudioPlayer: () => ({
    isLoaded: true, isPlaying: false, positionMs: 0,
    durationMs: 60000, error: null, play: jest.fn(),
    pause: jest.fn(), seekTo: jest.fn(),
  }),
}));

jest.mock("../../client/components/AudioPlayer", () => ({
  AudioPlayer: (props: { audioUri?: string }) => {
    const { View, Text } = require("react-native");
    return (
      <View testID="audio-player-mock">
        <Text>{props.audioUri ?? "no-url"}</Text>
      </View>
    );
  },
}));

describe("AudioBottomSheet", () => {
  const defaultProps = {
    visible: true,
    onDismiss: jest.fn(),
    audioUrl: "https://example.com/track.mp3",
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders with testID when visible", () => {
    const { getByTestId } = render(<AudioBottomSheet {...defaultProps} />);
    expect(getByTestId("audio-bottom-sheet")).toBeTruthy();
  });

  it("does not render content when not visible", () => {
    const { queryByTestId } = render(
      <AudioBottomSheet {...defaultProps} visible={false} />
    );
    expect(queryByTestId("audio-bottom-sheet")).toBeNull();
  });

  it("renders AudioPlayer inside the sheet", () => {
    const { getByTestId } = render(<AudioBottomSheet {...defaultProps} />);
    expect(getByTestId("audio-player-mock")).toBeTruthy();
  });

  it("passes audioUrl to AudioPlayer", () => {
    const { getByText } = render(<AudioBottomSheet {...defaultProps} />);
    expect(getByText("https://example.com/track.mp3")).toBeTruthy();
  });

  it("calls onDismiss when close button is pressed", () => {
    const onDismiss = jest.fn();
    const { getByLabelText } = render(
      <AudioBottomSheet {...defaultProps} onDismiss={onDismiss} />
    );
    fireEvent.press(getByLabelText("Close audio player"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
