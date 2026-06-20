import { renderHook, act } from "@testing-library/react-native";
import { useSynthPlayer } from "../../../client/hooks/useSynthPlayer";
import type { NoteEvent } from "../../../client/types/music";

// Mock synthEngine — control currentTime for position tracking
let mockCurrentTime = 0;
const mockPlayNote = jest.fn();
const mockStopAll = jest.fn().mockResolvedValue(undefined);
const mockResumeAudioContext = jest.fn().mockResolvedValue(undefined);
const mockGetCurrentTime = jest.fn(() => mockCurrentTime);
const mockGetAudioContext = jest.fn(() => ({
  currentTime: mockCurrentTime,
}));
const mockSetInstrumentMode = jest.fn();
const mockSetInstrumentSamples = jest.fn();

jest.mock("../../../client/lib/audio/synthEngine", () => ({
  getAudioContext: () => mockGetAudioContext(),
  resumeAudioContext: () => mockResumeAudioContext(),
  playNote: (...args: any[]) => mockPlayNote(...args),
  stopAll: () => mockStopAll(),
  destroyAudioContext: jest.fn(),
  getCurrentTime: () => mockGetCurrentTime(),
  setInstrumentMode: (...args: any[]) => mockSetInstrumentMode(...args),
  setInstrumentSamples: (...args: any[]) => mockSetInstrumentSamples(...args),
}));

const mockResetMasterGain = jest.fn();
const mockPruneEndedSources = jest.fn();
const mockDisconnectMasterBus = jest.fn();
jest.mock("../../../client/lib/audio/audioContext", () => ({
  resetMasterGain: () => mockResetMasterGain(),
  pruneEndedSources: () => mockPruneEndedSources(),
  disconnectMasterBus: () => mockDisconnectMasterBus(),
}));

const mockCreatePianoNote = jest.fn();
jest.mock("../../../client/lib/audio/pianoSamples", () => ({
  createPianoNote: (...args: any[]) => mockCreatePianoNote(...args),
}));

jest.mock("../../../client/lib/audio/samplePlayer", () => ({
  findClosestSample: jest.fn(),
  playSample: jest.fn(),
}));

jest.mock("../../../client/lib/audio/soundFontLoader", () => ({
  loadInstrumentSamples: jest.fn(),
  getInstrumentSampleDir: jest.fn(),
  instrumentSamplesExist: jest.fn().mockReturnValue(false),
}));

// Sample notes: C4 (0-0.5s), D4 (0.5-1.0s), E4 (1.0-1.5s)
const SAMPLE_NOTES: NoteEvent[] = [
  {
    pitch: "C4",
    midiNumber: 60,
    frequency: 261.63,
    startTime: 0,
    duration: 0.5,
    velocity: 80,
  },
  {
    pitch: "D4",
    midiNumber: 62,
    frequency: 293.66,
    startTime: 0.5,
    duration: 0.5,
    velocity: 80,
  },
  {
    pitch: "E4",
    midiNumber: 64,
    frequency: 329.63,
    startTime: 1.0,
    duration: 0.5,
    velocity: 80,
  },
];

describe("useSynthPlayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockCurrentTime = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("initial state", () => {
    it("starts with isPlaying false", () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));
      expect(result.current.isPlaying).toBe(false);
    });

    it("starts with positionMs 0", () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));
      expect(result.current.positionMs).toBe(0);
    });


    it("starts with no error", () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));
      expect(result.current.error).toBeNull();
    });

    it("computes durationMs from the notes array", () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));
      // Last note ends at 1.0 + 0.5 = 1.5s = 1500ms
      expect(result.current.durationMs).toBe(1500);
    });

    it("returns durationMs 0 for empty notes", () => {
      const { result } = renderHook(() => useSynthPlayer([]));
      expect(result.current.durationMs).toBe(0);
    });

    it("defaults to piano instrument", () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));
      expect(result.current.instrument).toBe("piano");
    });

    it("defaults to tempo 1.0", () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));
      expect(result.current.tempo).toBe(1.0);
    });

    it("defaults to no loop range", () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));
      expect(result.current.loopRange).toBeNull();
    });
  });

  describe("play", () => {
    it("sets isPlaying to true", async () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.play();
      });

      expect(result.current.isPlaying).toBe(true);
    });

    it("resumes audio context before scheduling", async () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.play();
      });

      expect(mockResumeAudioContext).toHaveBeenCalled();
    });

    it("schedules all notes via createPianoNote (default instrument)", async () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.play();
      });

      expect(mockCreatePianoNote).toHaveBeenCalledTimes(3);
      // Check first note is scheduled with correct frequency
      expect(mockCreatePianoNote.mock.calls[0][0]).toBeCloseTo(261.63, 1);
    });

    it("schedules via playNote when instrument is oscillator", async () => {
      const { result } = renderHook(() =>
        useSynthPlayer(SAMPLE_NOTES, "oscillator"),
      );

      await act(async () => {
        await result.current.play();
      });

      expect(mockPlayNote).toHaveBeenCalledTimes(3);
      expect(mockPlayNote.mock.calls[0][0]).toBeCloseTo(261.63, 1);
    });

    it("does nothing when notes array is empty", async () => {
      const { result } = renderHook(() => useSynthPlayer([]));

      await act(async () => {
        await result.current.play();
      });

      expect(result.current.isPlaying).toBe(false);
      expect(mockResumeAudioContext).not.toHaveBeenCalled();
    });

    it("resets the master bus to full volume on a fresh start (after a stop fade)", async () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.play();
      });
      await act(async () => {
        await result.current.stop();
      });
      mockResetMasterGain.mockClear();

      await act(async () => {
        await result.current.play();
      });

      // without this, notes scheduled after a stop fade would play silent
      expect(mockResetMasterGain).toHaveBeenCalled();
    });

    it("sets error when resumeAudioContext throws", async () => {
      mockResumeAudioContext.mockRejectedValueOnce(new Error("Audio unavailable"));
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.play();
      });

      expect(result.current.error).toBe("Audio unavailable");
      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe("pause", () => {
    it("sets isPlaying to false", async () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.play();
      });
      await act(async () => {
        await result.current.pause();
      });

      expect(result.current.isPlaying).toBe(false);
    });

    it("calls stopAll to stop audio", async () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.play();
      });
      mockStopAll.mockClear();
      await act(async () => {
        await result.current.pause();
      });

      expect(mockStopAll).toHaveBeenCalled();
    });

    it("preserves positionMs at the paused time", async () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.play();
      });

      // Advance the AudioContext clock to 0.58s. audioStartCtxSec = 0 + 0.08s
      // start delay, so pause() sees elapsed = 0.58 - 0.08 = 0.5s of playback.
      mockCurrentTime = 0.58;

      await act(async () => {
        await result.current.pause();
      });

      expect(result.current.positionMs).toBeCloseTo(500, -1);
    });
  });

  describe("stop", () => {
    it("sets isPlaying to false and resets position to 0", async () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.play();
      });
      await act(async () => {
        await result.current.stop();
      });

      expect(result.current.isPlaying).toBe(false);
      expect(result.current.positionMs).toBe(0);
    });

    it("calls stopAll", async () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.play();
      });
      mockStopAll.mockClear();
      await act(async () => {
        await result.current.stop();
      });

      expect(mockStopAll).toHaveBeenCalled();
    });
  });

  describe("seekTo", () => {
    it("updates positionMs when not playing", async () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.seekTo(750);
      });

      expect(result.current.positionMs).toBe(750);
    });

    it("clamps to 0 when seeking negative", async () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.seekTo(-100);
      });

      expect(result.current.positionMs).toBe(0);
    });

    it("clamps to durationMs when seeking past end", async () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.seekTo(99999);
      });

      expect(result.current.positionMs).toBe(1500);
    });

    it("reschedules notes when seeking during playback", async () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.play();
      });

      mockCreatePianoNote.mockClear();
      mockStopAll.mockClear();

      await act(async () => {
        await result.current.seekTo(1000);
      });

      // Should stop current playback and reschedule
      expect(mockStopAll).toHaveBeenCalled();
      expect(mockResumeAudioContext).toHaveBeenCalled();
      // Only the last note (E4, starts at 1.0s) should be scheduled fully
      expect(mockCreatePianoNote).toHaveBeenCalled();
    });
  });

  describe("position tracking", () => {
    it("updates positionMs as time progresses", async () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.play();
      });

      // AudioContext clock at 0.5s; minus the 0.08s start delay = 0.42s played.
      // A timer tick reads the AudioContext clock and writes positionMs = 420ms.
      mockCurrentTime = 0.5;
      await act(async () => {
        jest.advanceTimersByTime(50);
      });

      expect(result.current.positionMs).toBeCloseTo(420, 0);
    });

    it("stops playback when reaching end of sequence", async () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.play();
      });

      // Push the AudioContext clock past the end: (1.6 - 0.08)s = 1.52s ≥ 1.5s
      // duration, so a timer tick ends playback and pins positionMs to 1500.
      mockCurrentTime = 1.6;
      await act(async () => {
        jest.advanceTimersByTime(50);
      });

      expect(result.current.isPlaying).toBe(false);
      expect(result.current.positionMs).toBe(1500);
    });
  });

  describe("tempo control", () => {
    it("scales durationMs by tempo", () => {
      const { result } = renderHook(() =>
        useSynthPlayer(SAMPLE_NOTES, "piano", 2.0),
      );
      // 1500ms / 2.0 = 750ms
      expect(result.current.durationMs).toBe(750);
    });

    it("setTempo updates tempo and durationMs", async () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.setTempo(0.5);
      });

      expect(result.current.tempo).toBe(0.5);
      // 1500ms / 0.5 = 3000ms
      expect(result.current.durationMs).toBe(3000);
    });

    it("clamps tempo to [0.25, 4.0]", async () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.setTempo(0.1);
      });
      expect(result.current.tempo).toBe(0.25);

      await act(async () => {
        await result.current.setTempo(10);
      });
      expect(result.current.tempo).toBe(4.0);
    });
  });

  describe("loop range", () => {
    it("sets and clears loop range", () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      act(() => {
        result.current.setLoopRange({ startMs: 200, endMs: 800 });
      });
      expect(result.current.loopRange).toEqual({ startMs: 200, endMs: 800 });

      act(() => {
        result.current.clearLoopRange();
      });
      expect(result.current.loopRange).toBeNull();
    });
  });

  describe("play after stop (restart)", () => {
    it("restarts from beginning after stop", async () => {
      const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      await act(async () => {
        await result.current.play();
      });
      await act(async () => {
        await result.current.stop();
      });

      mockCreatePianoNote.mockClear();
      mockCurrentTime = 0;

      await act(async () => {
        await result.current.play();
      });

      expect(result.current.isPlaying).toBe(true);
      expect(mockCreatePianoNote).toHaveBeenCalledTimes(3);
    });
  });

  describe("cleanup", () => {
    it("destroys audio context on unmount", () => {
      const { destroyAudioContext: mockDestroy } = jest.requireMock(
        "../../../client/lib/audio/synthEngine",
      );
      const { unmount } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

      mockDestroy.mockClear();
      unmount();

      expect(mockDestroy).toHaveBeenCalled();
    });
  });
});

// ─── Phase 2: Remove dead currentNoteIndex (RED) ─────────────────────────────
// This test FAILS against the current implementation (currentNoteIndex exists).

describe("useSynthPlayer — currentNoteIndex removal (Phase 2)", () => {
  it("2.7 — currentNoteIndex is NOT in the return value (dead state removed)", () => {
    const { result } = renderHook(() => useSynthPlayer([]));
    expect((result.current as unknown as Record<string, unknown>).currentNoteIndex).toBeUndefined();
  });
});

// ─── Phase 3: AppState background pause (RED) ──────────────────────────────────
// These tests FAIL without AppState listener implementation.

describe("useSynthPlayer — AppState background pause", () => {
  let mockAppStateRemove: jest.Mock;
  let appStateCallback: ((state: string) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockCurrentTime = 0;
    mockAppStateRemove = jest.fn();

    // Capture the AppState callback so tests can trigger it
    const mockAppState = require("react-native").AppState;
    mockAppState.addEventListener.mockImplementation(
      (_: string, cb: (state: string) => void) => {
        appStateCallback = cb;
        return { remove: mockAppStateRemove };
      }
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("3.1 — registers AppState listener on mount", () => {
    const mockAppState = require("react-native").AppState;
    mockAppState.addEventListener.mockClear();

    renderHook(() => useSynthPlayer(SAMPLE_NOTES));

    expect(mockAppState.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function)
    );
  });

  it("3.2 — cleans up AppState listener on unmount", () => {
    const { unmount } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

    unmount();

    expect(mockAppStateRemove).toHaveBeenCalled();
  });

  it("3.3 — calls pause when app backgrounded while playing", async () => {
    const { result } = renderHook(() => useSynthPlayer(SAMPLE_NOTES));

    await act(async () => {
      await result.current.play();
    });

    mockStopAll.mockClear();
    mockDisconnectMasterBus.mockClear();

    // Trigger background event
    act(() => {
      appStateCallback?.("background");
    });

    // The pause() function is async and calls stopAll internally
    // Give it a tick to complete
    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(mockStopAll).toHaveBeenCalled();
    // Burst-on-resume guard: the master bus must be severed so notes scheduled
    // ahead can't fire into the speakers when the app foregrounds.
    expect(mockDisconnectMasterBus).toHaveBeenCalled();
  });

  it("3.4 — ignores background event when not playing", () => {
    renderHook(() => useSynthPlayer(SAMPLE_NOTES));

    mockStopAll.mockClear();

    // Trigger background while not playing
    act(() => {
      appStateCallback?.("background");
    });

    expect(mockStopAll).not.toHaveBeenCalled();
  });
});
