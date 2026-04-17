import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PracticeActiveView } from "../../client/components/PracticeActiveView";

jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#333", textSecondary: "#888", primary: "#2563EB",
      backgroundDefault: "#FFF", surface: "#F8F9FA", backgroundSecondary: "#F8F9FA",
      borderLight: "#F3F4F6", buttonText: "#FFF", error: "#DC2626",
    },
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

jest.mock("react-native-webview", () => ({ WebView: "WebView" }));

jest.mock("../../client/components/InteractiveScore", () => ({
  InteractiveScore: (props: { testID?: string }) => {
    const { View } = require("react-native");
    return <View testID={props.testID ?? "interactive-score"} />;
  },
}));

jest.mock("../../client/components/PitchStrip", () => ({
  PitchStrip: () => {
    const { View } = require("react-native");
    return <View testID="pitch-strip" />;
  },
}));

jest.mock("../../client/components/MetronomeBottomSheet", () => ({
  MetronomeBottomSheet: ({ visible }: { visible: boolean }) => {
    const { View } = require("react-native");
    return visible ? <View testID="metronome-bottom-sheet" /> : null;
  },
}));

jest.mock("../../client/components/AudioBottomSheet", () => ({
  AudioBottomSheet: ({ visible }: { visible: boolean }) => {
    const { View } = require("react-native");
    return visible ? <View testID="audio-bottom-sheet" /> : null;
  },
}));

const baseSynthPlayer = {
  isPlaying: false, play: jest.fn(), pause: jest.fn(), stop: jest.fn(), seekTo: jest.fn(),
  currentNoteIndex: 0, instrument: "piano", instrumentLoading: false, error: null,
  setInstrument: jest.fn(), setTempo: jest.fn(), tempo: 1.0, positionMs: 0, durationMs: 0,
  loopRange: null, setLoopRange: jest.fn(), clearLoopRange: jest.fn(),
};

const baseNoteEditor = {
  editedMusicXml: "", selectedIndex: null, selectedPitch: null,
  hasEdits: false, selectNote: jest.fn(), applyPitch: jest.fn(), dismiss: jest.fn(), resetEdits: jest.fn(),
};

const baseProps = {
  title: "La Traviata",
  musicXml: "<score/>",
  synthPlayer: baseSynthPlayer,
  noteEditor: baseNoteEditor,
  isListening: false,
  currentPitch: null,
  currentBpm: 120,
  audioUrl: "https://example.com/track.mp3",
  onGoBack: jest.fn(),
};

describe("PracticeActiveView", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders title in header", () => {
    const { getByText } = render(<PracticeActiveView {...baseProps} />);
    expect(getByText("La Traviata")).toBeTruthy();
  });

  it("renders InteractiveScore", () => {
    const { getByTestId } = render(<PracticeActiveView {...baseProps} />);
    expect(getByTestId("interactive-score")).toBeTruthy();
  });

  it("renders PitchStrip", () => {
    const { getByTestId } = render(<PracticeActiveView {...baseProps} />);
    expect(getByTestId("pitch-strip")).toBeTruthy();
  });

  it("renders bottom toolbar", () => {
    const { getByTestId } = render(<PracticeActiveView {...baseProps} />);
    expect(getByTestId("practice-toolbar")).toBeTruthy();
  });

  it("calls play when play button pressed", () => {
    const play = jest.fn();
    const { getByLabelText } = render(
      <PracticeActiveView {...baseProps} synthPlayer={{ ...baseSynthPlayer, play }} />
    );
    fireEvent.press(getByLabelText("Play"));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("calls pause when pause button pressed during playback", () => {
    const pause = jest.fn();
    const { getByLabelText } = render(
      <PracticeActiveView
        {...baseProps}
        synthPlayer={{ ...baseSynthPlayer, isPlaying: true, pause }}
      />
    );
    fireEvent.press(getByLabelText("Pause"));
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("opens metronome bottom sheet when metronome button pressed", () => {
    const { getByLabelText, getByTestId, queryByTestId } = render(
      <PracticeActiveView {...baseProps} />
    );
    expect(queryByTestId("metronome-bottom-sheet")).toBeNull();
    fireEvent.press(getByLabelText("Open metronome"));
    expect(getByTestId("metronome-bottom-sheet")).toBeTruthy();
  });

  it("opens audio bottom sheet when audio button pressed", () => {
    const { getByLabelText, getByTestId, queryByTestId } = render(
      <PracticeActiveView {...baseProps} />
    );
    expect(queryByTestId("audio-bottom-sheet")).toBeNull();
    fireEvent.press(getByLabelText("Open audio player"));
    expect(getByTestId("audio-bottom-sheet")).toBeTruthy();
  });

  it("calls onGoBack when back button pressed", () => {
    const onGoBack = jest.fn();
    const { getByLabelText } = render(
      <PracticeActiveView {...baseProps} onGoBack={onGoBack} />
    );
    fireEvent.press(getByLabelText("Go back"));
    expect(onGoBack).toHaveBeenCalledTimes(1);
  });
});
