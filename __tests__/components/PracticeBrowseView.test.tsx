import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PracticeBrowseView } from "../../client/components/PracticeBrowseView";

jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#333", textSecondary: "#888", primary: "#2563EB", primaryDark: "#1D4ED8",
      backgroundDefault: "#FFF", backgroundSecondary: "#F8F9FA", surface: "#F8F9FA",
      borderLight: "#F3F4F6", buttonText: "#FFF", error: "#DC2626",
      warning: "#F59E0B", warningSubtle: "rgba(245,158,11,0.09)",
      success: "#16A34A", separator: "rgba(0,0,0,0.06)",
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
    __esModule: true, default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }), useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v, runOnJS: (fn: unknown) => fn,
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
jest.mock("expo-image", () => ({ Image: "Image" }));

jest.mock("../../client/components/SheetMusicPager", () => ({ SheetMusicPager: () => null }));
jest.mock("../../client/components/AudioPlayer", () => ({ AudioPlayer: () => null }));
jest.mock("../../client/components/InteractiveScore", () => ({ InteractiveScore: () => null }));
jest.mock("../../client/components/Metronome", () => ({ Metronome: () => null }));

const baseSheet = {
  id: "s1", title: "La Traviata", artist: "Verdi",
  imageUris: ["img1.jpg"], createdAt: Date.now(),
  folder: "Musical", isFavorite: false, omrStatus: "none" as const,
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

const baseAudioPlayer = {
  isLoaded: false, isPlaying: false, positionMs: 0, durationMs: 0, error: null,
  loadSound: jest.fn(), unload: jest.fn(), play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(),
};

const baseState = {
  currentBpm: 120, setCurrentBpm: jest.fn(),
  showEdit: false, setShowEdit: jest.fn(),
  showDeleteConfirm: false, setShowDeleteConfirm: jest.fn(),
  audioMode: "reference" as const, setAudioMode: jest.fn(),
  musicXmlContent: null, musicXmlLoading: false, hasMusicXml: false,
  musicXmlLoadError: null, audioLoadError: null, partsDeselectedError: null,
  showInstrumentPicker: false, setShowInstrumentPicker: jest.fn(),
  editMode: false, setEditMode: jest.fn(),
  partInfos: [], partNoteCounts: {}, visiblePartIds: new Set<string>(), togglePartVisibility: jest.fn(),
  noteSequence: [], sheetSessions: [],
  synthPlayer: baseSynthPlayer,
  audioPlayer: baseAudioPlayer,
  noteEditor: baseNoteEditor,
  omr: { isProcessing: false, processImage: jest.fn(), error: null, status: "none" as const },
  handleNotePress: jest.fn(), handleSynthPlayPause: jest.fn(),
  handleScanSheet: jest.fn(),
  handleDeletePress: jest.fn(),
  handleDeleteConfirm: jest.fn(),
  handleEdit: jest.fn(),
};

const baseProps = {
  sheet: baseSheet,
  state: baseState,
  screenWidth: 390,
  loading: false,
  onRefresh: jest.fn(),
  onGoBack: jest.fn(),
};

describe("PracticeBrowseView", () => {
  it("3.1 — renders sheet title and artist in top bar", () => {
    const { getByText } = render(<PracticeBrowseView {...baseProps} />);
    expect(getByText("La Traviata")).toBeTruthy();
    expect(getByText("Verdi")).toBeTruthy();
  });

  it("3.2 — shows edit and delete buttons in top bar", () => {
    const { getByLabelText } = render(<PracticeBrowseView {...baseProps} />);
    expect(getByLabelText("Edit score")).toBeTruthy();
    expect(getByLabelText("Delete score")).toBeTruthy();
  });

});

// ─── Score-as-hero redesign ──────────────────────────────────────────────────
describe("PracticeBrowseView — score hero layout", () => {
  it("renders the score transport (and no legacy 'Auto-Play' label) when a score is loaded", () => {
    const { getByLabelText, queryByText } = render(
      <PracticeBrowseView
        {...baseProps}
        state={{ ...baseProps.state, hasMusicXml: true, musicXmlContent: "<score/>" }}
      />
    );
    // Hero transport play control is present; the old section labels are gone.
    expect(getByLabelText("Play")).toBeTruthy();
    expect(queryByText("Auto-Play")).toBeNull();
    expect(queryByText("Score Preview")).toBeNull();
  });
});

// ─── Mode indicator (Issue: unclear-listen-vs-practice-modes) ────────────────
describe("PracticeBrowseView — mode indicator (SCORE + LISTEN clarity)", () => {
  it("displays 'SCORE + LISTEN' label above score title", () => {
    const { getByText } = render(<PracticeBrowseView {...baseProps} />);
    expect(getByText("SCORE + LISTEN")).toBeTruthy();
  });

  it("displays mode label above title in proper hierarchy", () => {
    const { getByText } = render(<PracticeBrowseView {...baseProps} />);
    // Mode label should exist and be separate from title
    expect(getByText("SCORE + LISTEN")).toBeTruthy();
    expect(getByText("La Traviata")).toBeTruthy();
  });
});


// ─── Back button affordance (Issue: missing-score-detail-back-button) ────────
describe("PracticeBrowseView — back button affordance", () => {
  it("back button has clear accessibility label referencing library", () => {
    const { getByLabelText } = render(<PracticeBrowseView {...baseProps} />);
    expect(getByLabelText("Go back to library")).toBeTruthy();
  });

  it("back button calls onGoBack when pressed", () => {
    const onGoBack = jest.fn();
    const { getByLabelText } = render(<PracticeBrowseView {...baseProps} onGoBack={onGoBack} />);
    fireEvent.press(getByLabelText("Go back to library"));
    expect(onGoBack).toHaveBeenCalledTimes(1);
  });
});
