import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import PracticeDetailScreen from "../../client/screens/PracticeDetailScreen";

// Mock navigation
const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: { sheetId: "sheet-1" } }),
}));

// Mock useTheme
jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#333333",
      textSecondary: "#888888",
      primary: "#2563EB",
      primaryDark: "#1D4ED8",
      primaryLight: "rgba(37,99,235,0.09)",
      primarySubtle: "rgba(37,99,235,0.19)",
      success: "#16A34A",
      successLight: "rgba(22,163,74,0.09)",
      warning: "#F59E0B",
      warningSubtle: "rgba(245,158,11,0.09)",
      warningLight: "rgba(245,158,11,0.05)",
      warningBorder: "rgba(245,158,11,0.15)",
      error: "#DC2626",
      errorLight: "rgba(220,38,38,0.09)",
      backgroundDefault: "#FFFFFF",
      backgroundSecondary: "#F8F9FA",
      surface: "#F8F9FA",
      card: "#FFFFFF",
      borderLight: "#F3F4F6",
      separator: "rgba(0,0,0,0.06)",
      buttonText: "#FFFFFF",
      overlay: "rgba(0,0,0,0.4)",
      ripple: "rgba(0,0,0,0.1)",
      rippleLight: "rgba(255,255,255,0.3)",
      accent: "#F59E0B",
      accentLight: "rgba(245,158,11,0.09)",
    },
    isDark: false,
  }),
}));

// Mock safe area
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

// Mock icons
jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

// Mock expo-blur
jest.mock("expo-blur", () => ({
  BlurView: "BlurView",
}));

// Mock haptics
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("expo-av", () => ({
  Audio: { setAudioModeAsync: jest.fn().mockResolvedValue(undefined) },
}));

// Mock reanimated
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: {
      View: View,
      createAnimatedComponent: (c: any) => c,
    },
    useSharedValue: (v: any) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: any) => v,
    runOnJS: (fn: any) => fn,
  };
});

// Mock gesture handler
jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  return {
    GestureDetector: ({ children }: any) => children,
    GestureHandlerRootView: View,
    Gesture: {
      Pan: () => ({
        onStart: function () { return this; },
        onUpdate: function () { return this; },
        onEnd: function () { return this; },
      }),
      Pinch: () => ({
        onStart: function () { return this; },
        onUpdate: function () { return this; },
        onEnd: function () { return this; },
      }),
      Tap: () => ({
        numberOfTaps: function () { return this; },
        onEnd: function () { return this; },
      }),
      Simultaneous: (...args: any[]) => args[0],
      Exclusive: (...args: any[]) => args[0],
    },
  };
});

// Mock react-native-svg
jest.mock("react-native-svg", () => {
  const { View, Text } = require("react-native");
  return {
    __esModule: true,
    default: View,
    Svg: View,
    Line: View,
    Ellipse: (props: any) => <View testID={props.testID} />,
    Text: Text,
    G: View,
  };
});

// Mock expo-image
jest.mock("expo-image", () => ({
  Image: "Image",
}));

// Mock PracticeContext
const mockSheets = [
  {
    id: "sheet-1",
    title: "Test Sonata",
    artist: "Mozart",
    imageUris: ["img1.jpg", "img2.jpg"],
    createdAt: Date.now(),
    folder: "Classical",
    isFavorite: false,
  },
];

jest.mock("../../client/context/PracticeContext", () => ({
  usePractice: () => ({
    sheets: mockSheets,
    sessions: [],
    recordings: [],
    addSession: jest.fn().mockResolvedValue("session-1"),
    editSheet: jest.fn(),
    patchSheet: jest.fn(),
    removeSheet: jest.fn(),
    removeRecording: jest.fn(),
    refreshData: jest.fn(),
    loading: false,
  }),
}));

// Mock hooks
jest.mock("../../client/hooks/useTimer", () => ({
  useTimer: () => ({
    seconds: 0,
    isRunning: false,
    start: jest.fn(),
    pause: jest.fn(),
    formatTime: (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`,
  }),
}));

// Mock RenameModal
jest.mock("../../client/components/RenameModal", () => ({
  RenameModal: () => null,
  __esModule: true,
}));

// New mocks needed after usePracticeDetail extraction
jest.mock("react-native-webview", () => ({ WebView: "WebView" }));

jest.mock("../../client/hooks/useSynthPlayer", () => ({
  useSynthPlayer: () => ({
    isPlaying: false, play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(),
    currentNoteIndex: null, instrument: "piano", instrumentLoading: false,
    setInstrument: jest.fn(), setTempo: jest.fn(), tempo: 1.0, positionMs: 0, durationMs: 0,
  }),
}));


jest.mock("../../client/hooks/usePracticeDetail", () => ({
  usePracticeDetail: () => ({
    showEdit: false,
    setShowEdit: jest.fn(),
    showDeleteConfirm: false,
    setShowDeleteConfirm: jest.fn(),
    showInstrumentPicker: false,
    setShowInstrumentPicker: jest.fn(),
    editMode: false,
    setEditMode: jest.fn(),
    synthPlayer: {
      isPlaying: false,
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(),
      currentNoteIndex: null,
      instrument: "piano",
      instrumentLoading: false,
      setInstrument: jest.fn(),
      setTempo: jest.fn(),
      tempo: 1.0,
      positionMs: 0,
      durationMs: 0,
      loopRange: null,
      setLoopRange: jest.fn(),
      clearLoopRange: jest.fn(),
    },
    noteEditor: {
      editedMusicXml: "",
      selectedIndex: null,
      selectedPitch: null,
      hasEdits: false,
      selectNote: jest.fn(),
      applyPitch: jest.fn(),
      dismiss: jest.fn(),
    },
    handleDeleteConfirm: jest.fn(),
    handleEdit: jest.fn(),
    musicXmlContent: null,
    partInfos: [],
    visiblePartIds: new Set(),
    togglePartVisibility: jest.fn(),
    currentBpm: 120,
    musicXmlLoading: false,
    hasMusicXml: false,
    omr: { isProcessing: false, processImage: jest.fn(), error: null },
    audioPlayer: {
      isLoaded: false,
      isPlaying: false,
      loadSound: jest.fn(),
      unload: jest.fn(),
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(),
    },
    handleNotePress: jest.fn(),
    handleSynthPlayPause: jest.fn(),
    handleScanSheet: jest.fn(),
    handleDeletePress: jest.fn(),
    audioMode: "reference",
    setAudioMode: jest.fn(),
    noteSequence: [],
    sheetSessions: [],
    musicXmlLoadError: null,
    audioLoadError: null,
    partsDeselectedError: null,
    partNoteCounts: {},
  }),
}));

describe("PracticeDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders Browse mode by default with sheet title", () => {
    const { getByText } = render(<PracticeDetailScreen />);
    expect(getByText("Test Sonata")).toBeTruthy();
  });

  it("renders Browse mode with artist name", () => {
    const { getByText } = render(<PracticeDetailScreen />);
    expect(getByText("Mozart")).toBeTruthy();
  });

  it("shows back button", () => {
    const { getByLabelText } = render(<PracticeDetailScreen />);
    expect(getByLabelText(/Go back to library/)).toBeTruthy();
  });

  it("navigates back when back button pressed", () => {
    const { getByLabelText } = render(<PracticeDetailScreen />);
    fireEvent.press(getByLabelText(/Go back to library/));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("shows edit and delete buttons in browse mode", () => {
    const { getByLabelText } = render(<PracticeDetailScreen />);
    expect(getByLabelText("Edit score")).toBeTruthy();
    expect(getByLabelText("Delete score")).toBeTruthy();
  });

  it("shows edit and delete buttons", () => {
    const { getByLabelText } = render(<PracticeDetailScreen />);
    // Core controls should be in the top bar
    expect(getByLabelText("Edit score")).toBeTruthy();
    expect(getByLabelText("Delete score")).toBeTruthy();
  });


  it("renders score not found when sheet doesn't exist", () => {
    // Override mockSheets to return no match
    const origSheets = [...mockSheets];
    mockSheets.length = 0;

    const { getByText } = render(<PracticeDetailScreen />);
    expect(getByText("Score not found")).toBeTruthy();

    // Restore
    mockSheets.push(...origSheets);
  });
});
