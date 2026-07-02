import { renderHook, act } from "@testing-library/react-native";
import { useSynthPlayer } from "../../../client/hooks/useSynthPlayer";
import type { NoteEvent } from "../../../client/types/music";

// Mock synthEngine — control currentTime for position tracking
let mockCurrentTime = 0;
const mockPlayNote = jest.fn();
const mockStopAll = jest.fn().mockResolvedValue(undefined);
const mockResumeAudioContext = jest.fn().mockResolvedValue(undefined);

jest.mock("../../../client/lib/audio/synthEngine", () => ({
  getAudioContext: () => ({ currentTime: mockCurrentTime }),
  resumeAudioContext: () => mockResumeAudioContext(),
  playNote: (...args: unknown[]) => mockPlayNote(...args),
  stopAll: () => mockStopAll(),
  destroyAudioContext: jest.fn(),
  getCurrentTime: () => mockCurrentTime,
  setInstrumentMode: jest.fn(),
  setInstrumentSamples: jest.fn(),
}));

jest.mock("../../../client/lib/audio/audioContext", () => ({
  resetMasterGain: jest.fn(),
  pruneEndedSources: jest.fn(),
  disconnectMasterBus: jest.fn(),
}));

const mockCreatePianoNote = jest.fn();
jest.mock("../../../client/lib/audio/pianoSamples", () => ({
  createPianoNote: (...args: unknown[]) => mockCreatePianoNote(...args),
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

function note(pitch: string, frequency: number, startTime: number, duration = 0.5): NoteEvent {
  return { pitch, midiNumber: 60, frequency, startTime, duration, velocity: 80 };
}

const C4 = 261.63;
const D4 = 293.66;
const F4 = 349.23;
const G4 = 392.0;

// "All parts": near notes at 0/0.5s plus a far F4 at 5s (beyond the 4s
// scheduling window, so it only arrives via a rolling top-up).
const ALL_PARTS: NoteEvent[] = [note("C4", C4, 0), note("D4", D4, 0.5), note("F4", F4, 5.0)];
// "Filtered" (a part was muted): D4 gone, far note replaced by G4 at 5s.
const FILTERED: NoteEvent[] = [note("C4", C4, 0), note("G4", G4, 5.0)];

const scheduledFrequencies = () => mockCreatePianoNote.mock.calls.map((c) => c[0] as number);

describe("useSynthPlayer — notes array change mid-playback (part toggle)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockCurrentTime = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("stops old audio and reschedules the new notes from the current position", async () => {
    const { result, rerender } = renderHook<ReturnType<typeof useSynthPlayer>, { notes: NoteEvent[] }>(({ notes }) => useSynthPlayer(notes), {
      initialProps: { notes: ALL_PARTS },
    });

    await act(async () => {
      await result.current.play();
    });

    // 0.28s on the AudioContext clock = 0.2s into playback (0.08s start delay).
    mockCurrentTime = 0.28;
    mockStopAll.mockClear();
    mockCreatePianoNote.mockClear();

    await act(async () => {
      rerender({ notes: FILTERED });
    });

    expect(mockStopAll).toHaveBeenCalled();
    // C4 is still sounding at 0.2s so it reschedules (truncated); D4 must NOT —
    // it belongs to the muted part and is absent from the new array.
    expect(scheduledFrequencies()).toContain(C4);
    expect(scheduledFrequencies()).not.toContain(D4);
    // Position continues — it must not jump back to 0.
    expect(result.current.isPlaying).toBe(true);
  });

  it("rolling top-ups after the change schedule from the NEW array (no stale closure)", async () => {
    const { result, rerender } = renderHook<ReturnType<typeof useSynthPlayer>, { notes: NoteEvent[] }>(({ notes }) => useSynthPlayer(notes), {
      initialProps: { notes: ALL_PARTS },
    });

    await act(async () => {
      await result.current.play();
    });

    mockCurrentTime = 0.28;
    await act(async () => {
      rerender({ notes: FILTERED });
    });
    mockCreatePianoNote.mockClear();

    // Land a tick just past the 2s top-up boundary. The re-anchor at 0.28s set
    // audioStartCtxSec=0.36 and offset=0.2, so position = 0.2 + (t - 0.36);
    // t=2.17 → 2010ms, which straddles the 2000ms boundary within one 50ms
    // tick and fires the top-up. The far note at 5s enters the 4s look-ahead.
    mockCurrentTime = 2.17;
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    const freqs = scheduledFrequencies();
    expect(freqs).toContain(G4); // from the new array
    expect(freqs).not.toContain(F4); // stale closure would schedule this
  });

  it("resets the schedule index when notes change while stopped, so next play starts clean", async () => {
    const { result, rerender } = renderHook<ReturnType<typeof useSynthPlayer>, { notes: NoteEvent[] }>(({ notes }) => useSynthPlayer(notes), {
      initialProps: { notes: ALL_PARTS },
    });

    await act(async () => {
      await result.current.play();
    });
    await act(async () => {
      await result.current.stop();
    });

    await act(async () => {
      rerender({ notes: FILTERED });
    });

    mockCreatePianoNote.mockClear();
    mockCurrentTime = 0;
    await act(async () => {
      await result.current.play();
    });

    // Both near notes of the new array scheduled from the top.
    expect(scheduledFrequencies()).toContain(C4);
    expect(scheduledFrequencies()).not.toContain(D4);
  });
});

describe("useSynthPlayer — initial position on the scaled timeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockCurrentTime = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("play() at non-1.0 tempo does not double-scale the initial positionMs", async () => {
    // Raw first note at 1.0s; at tempo 2.0 the scaled timeline puts it at 0.5s.
    const lateStart: NoteEvent[] = [note("C4", C4, 1.0)];
    const { result } = renderHook(() => useSynthPlayer(lateStart, "piano", 2.0));

    await act(async () => {
      await result.current.play();
    });

    // Buggy code multiplied the scaled offset by tempo again → 1000ms.
    expect(result.current.positionMs).toBeCloseTo(500, 0);
  });
});
