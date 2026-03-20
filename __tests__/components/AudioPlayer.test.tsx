import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { AudioPlayer } from "../../client/components/AudioPlayer";

// Mock useTheme
jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      primary: "#FF69B4",
      text: "#333333",
      textSecondary: "#888888",
      surface: "#FFF5F8",
      borderLight: "#FFE8F0",
      error: "#FF6B6B",
    },
  }),
}));

// Mock @expo/vector-icons
jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

// Mock useAudioPlayer
const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockSeekTo = jest.fn();
const mockLoadSound = jest.fn();
const mockUnload = jest.fn();

jest.mock("../../client/hooks/useAudioPlayer", () => ({
  useAudioPlayer: () => ({
    isLoaded: true,
    isPlaying: false,
    positionMs: 0,
    durationMs: 225000,
    error: null,
    loadSound: mockLoadSound,
    play: mockPlay,
    pause: mockPause,
    seekTo: mockSeekTo,
    unload: mockUnload,
  }),
}));

describe("AudioPlayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders play button", () => {
    const { toJSON } = render(<AudioPlayer audioUri="song.mp3" />);
    const json = JSON.stringify(toJSON());
    // Should have a play icon
    expect(json).toContain("play");
  });

  it("shows time labels", () => {
    const { getByText } = render(<AudioPlayer audioUri="song.mp3" />);

    // 0:00 position, 3:45 duration (225000ms)
    expect(getByText("0:00")).toBeTruthy();
    expect(getByText("3:45")).toBeTruthy();
  });

  it("calls play when play button is pressed", () => {
    const { getByAccessibilityHint } = render(<AudioPlayer audioUri="song.mp3" />);

    fireEvent.press(getByAccessibilityHint("Play or pause audio"));
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it("renders with accessibilityHint on play button", () => {
    const { getByAccessibilityHint } = render(<AudioPlayer audioUri="song.mp3" />);

    expect(getByAccessibilityHint("Play or pause audio")).toBeTruthy();
  });
});
