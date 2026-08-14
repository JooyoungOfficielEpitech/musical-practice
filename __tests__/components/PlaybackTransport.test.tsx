import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PlaybackTransport } from "../../client/components/PlaybackTransport";

jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#333", textSecondary: "#888", primary: "#2563EB",
      backgroundDefault: "#FFF", backgroundSecondary: "#F8F9FA", surface: "#F8F9FA",
      borderLight: "#F3F4F6", buttonText: "#FFF", error: "#DC2626",
      primarySubtle: "rgba(37,99,235,0.1)",
    },
  }),
}));

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

function makeSynthPlayer(overrides: Record<string, unknown> = {}) {
  return {
    isPlaying: false, positionMs: 0, durationMs: 60_000, error: null,
    instrument: "piano", instrumentLoading: false, tempo: 1.0, loopRange: null,
    play: jest.fn(), pause: jest.fn(), stop: jest.fn(), seekTo: jest.fn(),
    setInstrument: jest.fn(), setTempo: jest.fn(),
    setLoopRange: jest.fn(), clearLoopRange: jest.fn(),
    ...overrides,
  };
}

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    synthPlayer: makeSynthPlayer(),
    onPlayPause: jest.fn(),
    transpose: 0,
    onTransposeChange: jest.fn(),
    metronomeOn: false,
    onToggleMetronome: jest.fn(),
    loopArmed: false,
    onLoopPress: jest.fn(),
    ...overrides,
  };
}

describe("PlaybackTransport", () => {
  it("gives every 32px stepper button a hitSlop that reaches the 44dp touch target", () => {
    const { getByLabelText } = render(<PlaybackTransport {...(makeProps() as any)} />);
    for (const label of ["Decrease tempo", "Increase tempo", "Transpose down", "Transpose up"]) {
      const hitSlop = getByLabelText(label).props.hitSlop;
      expect(hitSlop.top).toBeGreaterThanOrEqual(6);
      expect(hitSlop.bottom).toBeGreaterThanOrEqual(6);
      expect(hitSlop.left).toBeGreaterThanOrEqual(6);
      expect(hitSlop.right).toBeGreaterThanOrEqual(6);
    }
  });

  it("renders play button and fires onPlayPause", () => {
    const props = makeProps();
    const { getByLabelText } = render(<PlaybackTransport {...(props as any)} />);
    fireEvent.press(getByLabelText("Play"));
    expect(props.onPlayPause).toHaveBeenCalledTimes(1);
  });

  it("shows pause label while playing", () => {
    const props = makeProps({ synthPlayer: makeSynthPlayer({ isPlaying: true }) });
    const { getByLabelText } = render(<PlaybackTransport {...(props as any)} />);
    expect(getByLabelText("Pause")).toBeTruthy();
  });

  it("shows current position and duration as mm:ss", () => {
    const props = makeProps({
      synthPlayer: makeSynthPlayer({ positionMs: 65_000, durationMs: 125_000 }),
    });
    const { getByText } = render(<PlaybackTransport {...(props as any)} />);
    expect(getByText("1:05")).toBeTruthy();
    expect(getByText("2:05")).toBeTruthy();
  });

  it("steps tempo down and up via synthPlayer.setTempo", () => {
    const synthPlayer = makeSynthPlayer({ tempo: 1.0 });
    const props = makeProps({ synthPlayer });
    const { getByLabelText } = render(<PlaybackTransport {...(props as any)} />);

    fireEvent.press(getByLabelText("Decrease tempo"));
    expect(synthPlayer.setTempo).toHaveBeenCalledWith(0.9);
    fireEvent.press(getByLabelText("Increase tempo"));
    expect(synthPlayer.setTempo).toHaveBeenCalledWith(1.1);
  });

  it("steps transposition down and up", () => {
    const props = makeProps({ transpose: 2 });
    const { getByLabelText, getByText } = render(<PlaybackTransport {...(props as any)} />);

    expect(getByText("+2 st")).toBeTruthy();
    fireEvent.press(getByLabelText("Transpose down"));
    expect(props.onTransposeChange).toHaveBeenCalledWith(1);
    fireEvent.press(getByLabelText("Transpose up"));
    expect(props.onTransposeChange).toHaveBeenCalledWith(3);
  });

  it("toggles the metronome", () => {
    const props = makeProps();
    const { getByLabelText } = render(<PlaybackTransport {...(props as any)} />);
    fireEvent.press(getByLabelText("Toggle metronome"));
    expect(props.onToggleMetronome).toHaveBeenCalledTimes(1);
  });

  it("fires onLoopPress and shows the arm label when idle", () => {
    const props = makeProps();
    const { getByLabelText } = render(<PlaybackTransport {...(props as any)} />);
    fireEvent.press(getByLabelText("Set loop start"));
    expect(props.onLoopPress).toHaveBeenCalledTimes(1);
  });

  it("shows the B label while armed", () => {
    const props = makeProps({ loopArmed: true });
    const { getByLabelText, getByText } = render(<PlaybackTransport {...(props as any)} />);
    expect(getByLabelText("Set loop end")).toBeTruthy();
    expect(getByText("A…")).toBeTruthy();
  });

  it("shows the clear label when a loop is active", () => {
    const props = makeProps({
      synthPlayer: makeSynthPlayer({ loopRange: { startMs: 0, endMs: 5_000 } }),
    });
    const { getByLabelText, getByText } = render(<PlaybackTransport {...(props as any)} />);
    fireEvent.press(getByLabelText("Clear loop"));
    expect(props.onLoopPress).toHaveBeenCalledTimes(1);
    expect(getByText("A–B")).toBeTruthy();
  });
});
