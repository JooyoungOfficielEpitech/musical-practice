import { useState, useCallback, useRef, useEffect } from "react";
import type { NoteEvent } from "../types/music";
import type { InstrumentMode } from "../lib/audio/synthEngine";
import {
  getAudioContext,
  resumeAudioContext,
  playNote,
  stopAll,
  getCurrentTime,
  setInstrumentMode,
  setInstrumentSamples,
} from "../lib/audio/synthEngine";
import { createPianoNote } from "../lib/audio/pianoSamples";
import {
  findClosestSample,
  playSample,
} from "../lib/audio/samplePlayer";
import {
  loadInstrumentSamples,
  getInstrumentSampleDir,
  instrumentSamplesExist,
} from "../lib/audio/soundFontLoader";
import type { AudioBuffer } from "react-native-audio-api";

export interface LoopRange {
  startMs: number;
  endMs: number;
}

export interface UseSynthPlayerReturn {
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  currentNoteIndex: number;
  error: string | null;
  instrument: string;
  instrumentLoading: boolean;
  tempo: number;
  loopRange: LoopRange | null;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  setInstrument: (instrument: string) => Promise<void>;
  setTempo: (multiplier: number) => Promise<void>;
  setLoopRange: (range: LoopRange) => void;
  clearLoopRange: () => void;
}

const POSITION_UPDATE_INTERVAL = 50; // ms

/**
 * Synth-based audio player hook for NoteEvent sequences.
 * Supports polyphonic playback, instrument selection, tempo control, and A/B looping.
 */
export function useSynthPlayer(
  notes: NoteEvent[],
  initialInstrument: string = "piano",
  initialTempo: number = 1.0,
): UseSynthPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [instrument, setInstrumentState] = useState(initialInstrument);
  const [instrumentLoading, setInstrumentLoading] = useState(false);
  const [tempo, setTempoState] = useState(initialTempo);
  const [loopRange, setLoopRangeState] = useState<LoopRange | null>(null);

  const playbackStartCtxTime = useRef(0);
  const playbackOffsetSec = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPlayingRef = useRef(false);
  const tempoRef = useRef(initialTempo);
  const loopRangeRef = useRef<LoopRange | null>(null);
  const loadedSamplesRef = useRef<Map<number, AudioBuffer> | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    tempoRef.current = tempo;
  }, [tempo]);

  useEffect(() => {
    loopRangeRef.current = loopRange;
  }, [loopRange]);

  // Compute total duration from the notes array, scaled by tempo
  const rawDurationMs =
    notes.length > 0
      ? Math.max(...notes.map((n) => (n.startTime + n.duration) * 1000))
      : 0;
  const durationMs = rawDurationMs / tempo;

  /**
   * Find the note index active at a given time (seconds, in tempo-scaled space).
   * For chords (multiple notes at the same startTime), returns the first note in the group.
   */
  const findNoteIndexAtTime = useCallback(
    (timeSec: number): number => {
      // Convert tempo-scaled time back to original note time
      const originalTimeSec = timeSec * tempoRef.current;

      for (let i = notes.length - 1; i >= 0; i--) {
        if (originalTimeSec >= notes[i].startTime) {
          // Scan backwards to find the first note in this chord group
          while (i > 0 && notes[i - 1].startTime === notes[i].startTime) {
            i--;
          }
          return i;
        }
      }
      return -1;
    },
    [notes],
  );

  /** Resolve instrument string to InstrumentMode. */
  const resolveMode = useCallback((inst: string): InstrumentMode => {
    if (inst === "oscillator") return "oscillator";
    if (inst === "piano") return "piano";
    return "samples";
  }, []);

  /** Play a single note using the current instrument mode with velocity. */
  const playNoteWithInstrument = useCallback(
    (
      note: NoteEvent,
      scheduledStart: number,
      actualDuration: number,
    ) => {
      const mode = resolveMode(instrument);

      switch (mode) {
        case "piano":
          createPianoNote(note.frequency, actualDuration, scheduledStart, note.velocity);
          break;

        case "samples": {
          const samples = loadedSamplesRef.current;
          if (samples && samples.size > 0) {
            const match = findClosestSample(note.midiNumber, samples);
            if (match) {
              const buffer = samples.get(match.sampleMidi);
              if (buffer) {
                playSample(buffer, scheduledStart, actualDuration, note.velocity, match.playbackRate);
              }
            }
          } else {
            // Fallback to piano if samples not loaded
            createPianoNote(note.frequency, actualDuration, scheduledStart, note.velocity);
          }
          break;
        }

        case "oscillator":
        default:
          playNote(note.frequency, actualDuration, scheduledStart, note.velocity);
          break;
      }
    },
    [instrument, resolveMode],
  );

  // Rolling scheduler: only schedule notes within a time window to avoid overloading AudioContext
  const SCHEDULE_AHEAD_SEC = 4;
  const lastScheduledIndexRef = useRef(0);

  /** Schedule notes from a given offset (in tempo-scaled seconds). Uses rolling window. */
  const scheduleFromOffset = useCallback(
    (offsetSec: number, isResume: boolean = false) => {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      const currentTempo = tempoRef.current;
      const tempoScale = 1 / currentTempo;
      let scheduledCount = 0;
      let skippedCount = 0;

      // When starting fresh (not a rolling top-up), reset the index
      if (!isResume) {
        lastScheduledIndexRef.current = 0;
      }

      const windowEnd = offsetSec + SCHEDULE_AHEAD_SEC;

      for (let i = lastScheduledIndexRef.current; i < notes.length; i++) {
        const note = notes[i];
        const scaledStart = note.startTime * tempoScale;
        const scaledDuration = note.duration * tempoScale;

        const relativeStart = scaledStart - offsetSec;
        const relativeEnd = relativeStart + scaledDuration;

        // Skip notes that have already fully elapsed
        if (relativeEnd <= 0) {
          skippedCount++;
          continue;
        }

        // Stop scheduling if note is beyond our look-ahead window
        if (scaledStart > windowEnd) {
          lastScheduledIndexRef.current = i;
          break;
        }

        const scheduledStart = now + Math.max(relativeStart, 0);
        const actualDuration =
          relativeStart < 0 ? scaledDuration + relativeStart : scaledDuration;

        if (actualDuration > 0) {
          scheduledCount++;
          playNoteWithInstrument(note, scheduledStart, actualDuration);
        }

        // Update last scheduled index
        if (i === notes.length - 1) {
          lastScheduledIndexRef.current = notes.length;
        }
      }

      console.log(`[SynthPlayer] scheduleFromOffset(${offsetSec.toFixed(2)}s) window=${windowEnd.toFixed(1)}s — scheduled=${scheduledCount}, skipped=${skippedCount}, nextIdx=${lastScheduledIndexRef.current}, ctxTime=${now.toFixed(3)}`);
      if (!isResume) {
        playbackStartCtxTime.current = now;
        playbackOffsetSec.current = offsetSec;
      }
    },
    [notes, playNoteWithInstrument],
  );

  /** Top up the rolling schedule with upcoming notes. */
  const topUpSchedule = useCallback(() => {
    if (!isPlayingRef.current || lastScheduledIndexRef.current >= notes.length) return;
    const elapsed = getCurrentTime() - playbackStartCtxTime.current;
    const currentSec = playbackOffsetSec.current + elapsed;
    scheduleFromOffset(currentSec, true);
  }, [notes, scheduleFromOffset]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Start the position tracking timer. */
  const startTimer = useCallback(() => {
    if (timerRef.current) return;

    timerRef.current = setInterval(() => {
      if (!isPlayingRef.current) return;

      const elapsed = getCurrentTime() - playbackStartCtxTime.current;
      const currentSec = playbackOffsetSec.current + elapsed;
      const currentMs = currentSec * 1000;
      const currentTempo = tempoRef.current;
      const currentDurationMs = rawDurationMs / currentTempo;
      const loop = loopRangeRef.current;

      // Check loop boundary
      if (loop && currentMs >= loop.endMs) {
        // Restart from loop start
        const loopStartSec = loop.startMs / 1000;
        stopAll().then(() => {
          resumeAudioContext().then(() => {
            scheduleFromOffset(loopStartSec);
            setPositionMs(loop.startMs);
            setCurrentNoteIndex(findNoteIndexAtTime(loopStartSec));
          });
        });
        return;
      }

      if (currentMs >= currentDurationMs) {
        console.log(`[SynthPlayer] playback ended — currentMs=${currentMs.toFixed(0)}, durationMs=${currentDurationMs.toFixed(0)}`);
        setPositionMs(currentDurationMs);
        setCurrentNoteIndex(notes.length > 0 ? findNoteIndexAtTime(currentDurationMs / 1000) : -1);
        setIsPlaying(false);
        isPlayingRef.current = false;
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }

      // Top up the rolling schedule every ~2 seconds
      if (Math.floor(currentMs / 2000) !== Math.floor((currentMs - POSITION_UPDATE_INTERVAL) / 2000)) {
        topUpSchedule();
      }

      // Log every ~2 seconds
      if (Math.floor(currentMs / 2000) !== Math.floor((currentMs - POSITION_UPDATE_INTERVAL) / 2000)) {
        const ctxState = getAudioContext().state;
        console.log(`[SynthPlayer] tick — pos=${(currentMs / 1000).toFixed(1)}s / ${(currentDurationMs / 1000).toFixed(1)}s, ctxState=${ctxState}`);
      }

      setPositionMs(currentMs);
      setCurrentNoteIndex(findNoteIndexAtTime(currentSec));
    }, POSITION_UPDATE_INTERVAL);
  }, [rawDurationMs, notes.length, findNoteIndexAtTime, scheduleFromOffset, topUpSchedule]);

  const play = useCallback(async () => {
    if (notes.length === 0) {
      console.log("[SynthPlayer] play() called but notes array is empty");
      return;
    }

    try {
      setError(null);
      console.log(`[SynthPlayer] play() — ${notes.length} notes, rawDurationMs=${rawDurationMs}, tempo=${tempoRef.current}`);
      await resumeAudioContext();

      const currentDurationMs = rawDurationMs / tempoRef.current;

      // If at end, restart from beginning (or loop start)
      let startOffset: number;
      const loop = loopRangeRef.current;
      const tempoScale = 1 / tempoRef.current;
      // Find the first note's start time (skip initial silence)
      const firstNoteTimeSec = notes.length > 0 ? notes[0].startTime * tempoScale : 0;

      if (positionMs >= currentDurationMs) {
        const restartMs = loop ? loop.startMs : firstNoteTimeSec * 1000;
        startOffset = restartMs / 1000;
        setPositionMs(restartMs);
        setCurrentNoteIndex(restartMs > 0 ? findNoteIndexAtTime(startOffset) : -1);
      } else if (positionMs === 0 && firstNoteTimeSec > 0) {
        // Skip initial silence on first play
        startOffset = firstNoteTimeSec;
        setPositionMs(firstNoteTimeSec * 1000);
        console.log(`[SynthPlayer] skipping initial silence, starting at ${firstNoteTimeSec.toFixed(2)}s`);
      } else {
        startOffset = positionMs / 1000;
      }

      console.log(`[SynthPlayer] scheduling from offset=${startOffset}s, durationMs=${rawDurationMs / tempoRef.current}`);
      scheduleFromOffset(startOffset);
      setIsPlaying(true);
      isPlayingRef.current = true;
      startTimer();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Synth playback failed";
      setError(msg);
      console.error("[useSynthPlayer] play error:", e);
    }
  }, [notes, positionMs, rawDurationMs, scheduleFromOffset, startTimer, findNoteIndexAtTime]);

  const pause = useCallback(async () => {
    console.log("[SynthPlayer] pause() called");
    // Capture elapsed time before stopping
    const elapsed = getCurrentTime() - playbackStartCtxTime.current;
    const currentSec = playbackOffsetSec.current + elapsed;
    playbackOffsetSec.current = currentSec;
    setPositionMs(currentSec * 1000);

    await stopAll();
    stopTimer();
    setIsPlaying(false);
    isPlayingRef.current = false;
  }, [stopTimer]);

  const stop = useCallback(async () => {
    console.log("[SynthPlayer] stop() called");
    await stopAll();
    stopTimer();
    setIsPlaying(false);
    isPlayingRef.current = false;
    setPositionMs(0);
    setCurrentNoteIndex(-1);
    playbackOffsetSec.current = 0;
  }, [stopTimer]);

  const seekTo = useCallback(
    async (ms: number) => {
      const currentDurationMs = rawDurationMs / tempoRef.current;
      const clampedMs = Math.max(0, Math.min(ms, currentDurationMs));
      setPositionMs(clampedMs);
      setCurrentNoteIndex(findNoteIndexAtTime(clampedMs / 1000));

      if (isPlayingRef.current) {
        await stopAll();
        stopTimer();
        await resumeAudioContext();
        scheduleFromOffset(clampedMs / 1000);
        startTimer();
      } else {
        playbackOffsetSec.current = clampedMs / 1000;
      }
    },
    [rawDurationMs, findNoteIndexAtTime, scheduleFromOffset, startTimer, stopTimer],
  );

  /** Change the instrument. Loads samples asynchronously if needed. */
  const setInstrument = useCallback(
    async (newInstrument: string) => {
      setInstrumentState(newInstrument);
      const mode = resolveMode(newInstrument);
      setInstrumentMode(mode);

      if (mode === "samples") {
        // Load samples if this is a sample-based instrument
        if (!instrumentSamplesExist(newInstrument)) {
          // No samples downloaded — fall back to piano
          setInstrumentMode("piano");
          setInstrumentSamples(null);
          loadedSamplesRef.current = null;
          return;
        }

        setInstrumentLoading(true);
        try {
          const dir = getInstrumentSampleDir(newInstrument);
          const samples = await loadInstrumentSamples(dir);
          setInstrumentSamples(samples);
          loadedSamplesRef.current = samples;
        } catch (e) {
          console.error("[useSynthPlayer] Failed to load samples:", e);
          // Fall back to piano
          setInstrumentMode("piano");
          setInstrumentSamples(null);
          loadedSamplesRef.current = null;
        } finally {
          setInstrumentLoading(false);
        }
      } else {
        setInstrumentSamples(null);
        loadedSamplesRef.current = null;
      }

      // If currently playing, reschedule with new instrument
      if (isPlayingRef.current) {
        const elapsed = getCurrentTime() - playbackStartCtxTime.current;
        const currentSec = playbackOffsetSec.current + elapsed;
        await stopAll();
        await resumeAudioContext();
        scheduleFromOffset(currentSec);
      }
    },
    [resolveMode, scheduleFromOffset],
  );

  /** Change the tempo multiplier. Reschedules if currently playing. */
  const setTempo = useCallback(
    async (multiplier: number) => {
      const clamped = Math.max(0.25, Math.min(4.0, multiplier));

      if (isPlayingRef.current) {
        // Calculate current position in original (unscaled) time
        const elapsed = getCurrentTime() - playbackStartCtxTime.current;
        const currentScaledSec = playbackOffsetSec.current + elapsed;
        // Convert current position to original time, then to new tempo-scaled time
        const originalTimeSec = currentScaledSec * tempoRef.current;
        const newScaledSec = originalTimeSec / clamped;

        setTempoState(clamped);
        tempoRef.current = clamped;

        await stopAll();
        stopTimer();
        await resumeAudioContext();

        setPositionMs(newScaledSec * 1000);
        scheduleFromOffset(newScaledSec);
        startTimer();
      } else {
        // Not playing — just update tempo and recalculate position
        const originalTimeSec = positionMs / 1000 * tempoRef.current;
        setTempoState(clamped);
        tempoRef.current = clamped;
        const newMs = (originalTimeSec / clamped) * 1000;
        setPositionMs(newMs);
        playbackOffsetSec.current = newMs / 1000;
      }
    },
    [positionMs, scheduleFromOffset, startTimer, stopTimer],
  );

  const setLoopRange = useCallback((range: LoopRange) => {
    setLoopRangeState(range);
    loopRangeRef.current = range;
  }, []);

  const clearLoopRange = useCallback(() => {
    setLoopRangeState(null);
    loopRangeRef.current = null;
  }, []);

  // Set initial instrument mode on mount
  useEffect(() => {
    setInstrumentMode(resolveMode(initialInstrument));
  }, [initialInstrument, resolveMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("[SynthPlayer] cleanup — unmounting, stopping all");
      stopTimer();
      stopAll();
    };
  }, [stopTimer]);

  return {
    isPlaying,
    positionMs,
    durationMs,
    currentNoteIndex,
    error,
    instrument,
    instrumentLoading,
    tempo,
    loopRange,
    play,
    pause,
    stop,
    seekTo,
    setInstrument,
    setTempo,
    setLoopRange,
    clearLoopRange,
  };
}
