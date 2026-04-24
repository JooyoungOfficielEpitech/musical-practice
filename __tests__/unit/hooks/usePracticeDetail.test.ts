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

  it("1.1 — boolean flags default correctly, currentBpm=120, audioMode=reference", () => {
    const { result } = renderHook(() => usePracticeDetail("sheet-1"));
    expect(result.current.isPracticing).toBe(false);
    expect(result.current.showMetronome).toBe(false);
    expect(result.current.showEdit).toBe(false);
    expect(result.current.editMode).toBe(true); // Phase 2: editMode defaults to true
    expect(result.current.currentBpm).toBe(120);
    expect(result.current.audioMode).toBe("reference");
  });

  it("1.2 — audioMode stays reference when sheet has musicXmlUri but no audioUri (no autoplay)", () => {
    const { result } = renderHook(() => usePracticeDetail("sheet-xml"));
    expect(result.current.audioMode).toBe("reference"); // Phase 2: no autoplay auto-trigger
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

// ─── Phase 2: Part Selection + EditMode + Autoplay (RED) ─────────────────────
// These tests FAIL against the current implementation.

describe("usePracticeDetail — part selection (Phase 2)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("2.1 — editMode defaults to true", () => {
    const { result } = renderHook(() => usePracticeDetail("sheet-1"));
    expect(result.current.editMode).toBe(true);
  });

  it("2.2 — audioMode never auto-switches to autoplay on XML load", () => {
    const { result } = renderHook(() => usePracticeDetail("sheet-xml"));
    expect(result.current.audioMode).toBe("reference");
  });

  it("2.3 — partInfos is an array in hook return", () => {
    const { result } = renderHook(() => usePracticeDetail("sheet-xml"));
    expect(Array.isArray(result.current.partInfos)).toBe(true);
  });

  it("2.4 — visiblePartIds is a Set in hook return", () => {
    const { result } = renderHook(() => usePracticeDetail("sheet-xml"));
    expect(result.current.visiblePartIds).toBeInstanceOf(Set);
  });

  it("2.5 — all parts visible by default (visiblePartIds.size === partInfos.length)", () => {
    const { result } = renderHook(() => usePracticeDetail("sheet-xml"));
    expect(result.current.visiblePartIds.size).toBe(result.current.partInfos.length);
  });

  it("2.6 — togglePartVisibility removes then restores a part id", () => {
    const { result } = renderHook(() => usePracticeDetail("sheet-xml"));
    const initialIds = Array.from(result.current.visiblePartIds);
    if (initialIds.length === 0) return; // no parts to toggle
    const firstId = initialIds[0];

    act(() => { result.current.togglePartVisibility(firstId); });
    expect(result.current.visiblePartIds.has(firstId)).toBe(false);

    act(() => { result.current.togglePartVisibility(firstId); });
    expect(result.current.visiblePartIds.has(firstId)).toBe(true);
  });

  it("2.7 — togglePartVisibility is a function in hook return", () => {
    const { result } = renderHook(() => usePracticeDetail("sheet-1"));
    expect(typeof result.current.togglePartVisibility).toBe("function");
  });
});
