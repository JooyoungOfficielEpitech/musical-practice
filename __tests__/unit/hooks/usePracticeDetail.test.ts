import { renderHook, act } from "@testing-library/react-native";
import { usePracticeDetail } from "../../../client/hooks/usePracticeDetail";

// ─── Navigation ───────────────────────────────────────────────────────────────
const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: { sheetId: "sheet-1" } }),
}));

// ─── PracticeContext ───────────────────────────────────────────────────────────
const mockSheets = [
  {
    id: "sheet-1",
    title: "Test Sonata",
    artist: "Mozart",
    imageUris: ["img1.jpg"],
    createdAt: Date.now(),
    folder: "Classical",
    isFavorite: false,
    // no audioUri, no musicXmlUri
  },
  {
    id: "sheet-xml",
    title: "XML Sheet",
    artist: "Bach",
    imageUris: [],
    createdAt: Date.now(),
    folder: "Classical",
    isFavorite: false,
    musicXmlUri: "file://x.xml",
    // no audioUri
  },
];

jest.mock("../../../client/context/PracticeContext", () => ({
  usePractice: () => ({
    sheets: mockSheets,
    sessions: [],
    recordings: [],
    addSession: jest.fn().mockResolvedValue("session-1"),
    editSheet: jest.fn(),
    removeSheet: jest.fn(),
    removeRecording: jest.fn(),
    renameRecording: jest.fn(),
    refreshData: jest.fn(),
    loading: false,
  }),
}));

// ─── Sub-hooks ────────────────────────────────────────────────────────────────
jest.mock("../../../client/hooks/useAudioPlayer", () => ({
  useAudioPlayer: () => ({
    isLoaded: false,
    isPlaying: false,
    loadSound: jest.fn(),
    unload: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
  }),
}));

jest.mock("../../../client/hooks/usePitchDetection", () => ({
  usePitchDetection: () => ({
    isListening: false,
    currentPitch: null,
    error: null,
    startListening: jest.fn(),
    stopListening: jest.fn(),
  }),
}));

jest.mock("../../../client/hooks/usePitchAccuracy", () => ({
  usePitchAccuracy: () => ({
    sessionAccuracy: 0,
    addReading: jest.fn(),
    reset: jest.fn(),
  }),
}));

jest.mock("../../../client/hooks/useAudioPermission", () => ({
  useAudioPermission: () => ({
    isGranted: true,
    requestPermission: jest.fn().mockResolvedValue(true),
  }),
}));

jest.mock("../../../client/hooks/useRecording", () => ({
  useRecording: () => ({
    isRecording: false,
    startRecording: jest.fn(),
    stopRecording: jest.fn().mockResolvedValue(undefined),
    addAudioData: jest.fn(),
  }),
}));

jest.mock("../../../client/hooks/useOmr", () => ({
  useOmr: () => ({
    isProcessing: false,
    processImage: jest.fn(),
    error: null,
  }),
}));

jest.mock("../../../client/hooks/useSynthPlayer", () => ({
  useSynthPlayer: () => ({
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
  }),
}));

jest.mock("../../../client/hooks/useNoteEditor", () => ({
  useNoteEditor: () => ({
    editedMusicXml: "",
    selectedIndex: null,
    selectedPitch: null,
    hasEdits: false,
    selectNote: jest.fn(),
    applyPitch: jest.fn(),
    dismiss: jest.fn(),
  }),
}));

// ─── Expo / RN side effects ───────────────────────────────────────────────────
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("react-native/Libraries/Utilities/Platform", () => ({
  OS: "ios",
  select: (obj: Record<string, unknown>) => obj.ios,
}));

// AppState.addEventListener must return { remove: fn } to avoid hook errors
const mockAppStateRemove = jest.fn();
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.AppState.addEventListener = jest.fn(() => ({ remove: mockAppStateRemove }));
  rn.LayoutAnimation.configureNext = jest.fn();
  return rn;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("usePracticeDetail — initial state", () => {
  beforeEach(() => jest.clearAllMocks());

  it("1.1 — boolean flags default to false, currentBpm=120, audioMode=reference", () => {
    const { result } = renderHook(() => usePracticeDetail("sheet-1"));
    expect(result.current.isPracticing).toBe(false);
    expect(result.current.showMetronome).toBe(false);
    expect(result.current.showEdit).toBe(false);
    expect(result.current.editMode).toBe(false);
    expect(result.current.currentBpm).toBe(120);
    expect(result.current.audioMode).toBe("reference");
  });

  it("1.2 — audioMode auto-selects to autoplay when sheet has musicXmlUri but no audioUri", () => {
    const { result } = renderHook(() => usePracticeDetail("sheet-xml"));
    expect(result.current.audioMode).toBe("autoplay");
  });

  it("1.3 — toggleMetronome flips showMetronome true then false", () => {
    const { result } = renderHook(() => usePracticeDetail("sheet-1"));
    expect(result.current.showMetronome).toBe(false);
    act(() => { result.current.toggleMetronome(); });
    expect(result.current.showMetronome).toBe(true);
    act(() => { result.current.toggleMetronome(); });
    expect(result.current.showMetronome).toBe(false);
  });

  it("1.4 — handleDeletePress sets showDeleteConfirm to true", () => {
    const { result } = renderHook(() => usePracticeDetail("sheet-1"));
    expect(result.current.showDeleteConfirm).toBe(false);
    act(() => { result.current.handleDeletePress(); });
    expect(result.current.showDeleteConfirm).toBe(true);
  });

  it("1.5 — bestScore is null when no sessions exist", () => {
    const { result } = renderHook(() => usePracticeDetail("sheet-1"));
    expect(result.current.bestScore).toBeNull();
  });
});
