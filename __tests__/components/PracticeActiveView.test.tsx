import React from "react";
import { render } from "@testing-library/react-native";
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

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
    runOnJS: (fn: unknown) => fn,
  };
});

jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    GestureHandlerRootView: View,
    Gesture: {
      Pan: () => ({ onStart: function() { return this; }, onUpdate: function() { return this; }, onEnd: function() { return this; } }),
      Pinch: () => ({ onStart: function() { return this; }, onUpdate: function() { return this; }, onEnd: function() { return this; } }),
      Tap: () => ({ numberOfTaps: function() { return this; }, onEnd: function() { return this; } }),
      Simultaneous: (...args: unknown[]) => args[0],
      Exclusive: (...args: unknown[]) => args[0],
    },
  };
});

jest.mock("react-native-svg", () => {
  const { View, Text } = require("react-native");
  return { __esModule: true, default: View, Svg: View, Line: View, Ellipse: (props: { testID?: string }) => <View testID={props.testID} />, Text, G: View };
});

jest.mock("react-native-webview", () => ({ WebView: "WebView" }));

jest.mock("../../client/components/FloatingPitchPanel", () => ({
  FloatingPitchPanel: () => null,
}));

jest.mock("../../client/components/InteractiveScore", () => ({
  InteractiveScore: (props: { testID?: string }) => {
    const { View } = require("react-native");
    return <View testID={props.testID ?? "interactive-score"} />;
  },
}));

jest.mock("../../client/components/SheetMusicViewer", () => ({
  SheetMusicViewer: () => null,
}));

const baseSheet = {
  id: "sheet-1", title: "La Traviata", artist: "Verdi",
  imageUris: ["img1.jpg"], createdAt: Date.now(),
  folder: "Musical", isFavorite: false,
};

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
  sheet: baseSheet,
  audioMode: "reference" as const,
  musicXmlContent: null,
  synthPlayer: baseSynthPlayer,
  noteEditor: baseNoteEditor,
  editMode: false,
  handleNotePress: jest.fn(),
  isListening: false,
  currentPitch: null,
  pitchError: null,
  sessionAccuracy: 0,
  isRecording: false,
  currentBpm: 120,
  setCurrentBpm: jest.fn(),
  topBarHeight: 56,
  practiceContentHeight: 800,
  screenWidth: 390,
  onGoBack: jest.fn(),
};

describe("PracticeActiveView", () => {
  it("2.1 — renders sheet title in top bar", () => {
    const { getByText } = render(<PracticeActiveView {...baseProps} />);
    expect(getByText("La Traviata")).toBeTruthy();
  });

  it("2.2 — shows InteractiveScore when audioMode=autoplay and musicXmlContent non-null", () => {
    const { getByTestId } = render(
      <PracticeActiveView
        {...baseProps}
        audioMode="autoplay"
        musicXmlContent="<score/>"
      />
    );
    expect(getByTestId("interactive-score")).toBeTruthy();
  });

  it("2.3 — shows SheetMusicViewer (not InteractiveScore) when audioMode=reference", () => {
    const { queryByTestId } = render(
      <PracticeActiveView {...baseProps} audioMode="reference" musicXmlContent="<score/>" />
    );
    expect(queryByTestId("interactive-score")).toBeNull();
  });
});
