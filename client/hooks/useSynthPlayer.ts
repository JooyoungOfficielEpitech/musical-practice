import { useState, useCallback, useRef, useEffect } from "react";
import { AppState } from "react-native";
import type { NoteEvent } from "../types/music";
import type { InstrumentMode } from "../lib/audio/synthEngine";
import {
  getAudioContext,
  resumeAudioContext,
  playNote,
  stopAll,
  destroyAudioContext,
  getCurrentTime,
  setInstrumentMode,
  setInstrumentSamples,
} from "../lib/audio/synthEngine";
import { resetMasterGain, pruneEndedSources, disconnectMasterBus } from "../lib/audio/audioContext";
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
  const [error, setError] = useState<string | null>(null);
  const [instrument, setInstrumentState] = useState(initialInstrument);
  const [instrumentLoading, setInstrumentLoading] = useState(false);
  const [tempo, setTempoState] = useState(initialTempo);
  const [loopRange, setLoopRangeState] = useState<LoopRange | null>(null);

  // AudioContext-clock time (seconds) that corresponds to playbackOffsetSec.
  // Position is derived from the SAME clock the notes are scheduled on, so the
  // score cursor can never drift from what you actually hear.
  const audioStartCtxSec = useRef(0);
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
  const PLAY_START_DELAY_SEC = 0.08; // 80ms head-start so cursor visually settles before first note plays
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

      // When starting fresh (not a rolling top-up), reset the index and restore
      // the master bus to full volume (a prior stop() faded it to silence).
      if (!isResume) {
        lastScheduledIndexRef.current = 0;
        resetMasterGain();
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

        const startDelay = isResume ? 0 : PLAY_START_DELAY_SEC;
        const scheduledStart = now + startDelay + Math.max(relativeStart, 0);
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
        // Anchor position tracking to the AudioContext clock (now + delay) — the
        // exact clock the notes above were scheduled against.
        audioStartCtxSec.current = now + PLAY_START_DELAY_SEC;
        playbackOffsetSec.current = offsetSec;
      }
    },
    [notes, playNoteWithInstrument],
  );

  /** Top up the rolling schedule with upcoming notes. */
  const topUpSchedule = useCallback(() => {
    if (!isPlayingRef.current || lastScheduledIndexRef.current >= notes.length) return;
    // Drop already-finished sources so the registry stays bounded over a long piece.
    pruneEndedSources();
    const elapsed = getCurrentTime() - audioStartCtxSec.current;
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

      const elapsed = getCurrentTime() - audioStartCtxSec.current;
      const currentSec = playbackOffsetSec.current + elapsed;
      // Clamp: don't go backward past the start offset (elapsed is negative during 80ms audio delay)
      const currentMs = Math.max(currentSec * 1000, playbackOffsetSec.current * 1000);
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
          });
        });
        return;
      }

      if (currentMs >= currentDurationMs) {
        console.log(`[SynthPlayer] playback ended — currentMs=${currentMs.toFixed(0)}, durationMs=${currentDurationMs.toFixed(0)}`);
        setPositionMs(currentDurationMs);
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

      // Log every second
      if (Math.floor(currentMs / 1000) !== Math.floor((currentMs - POSITION_UPDATE_INTERVAL) / 1000)) {
        const ctxState = getAudioContext().state;
        console.log(`[SynthPlayer] pos=${(currentMs / 1000).toFixed(2)}s / ${(currentDurationMs / 1000).toFixed(2)}s | elapsed=${(getCurrentTime() - audioStartCtxSec.current).toFixed(3)}s ctxState=${ctxState}`);
      }

      setPositionMs(currentMs);
    }, POSITION_UPDATE_INTERVAL);
  }, [rawDurationMs, notes.length, scheduleFromOffset, topUpSchedule]);

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
      // Send initial position immediately — don't wait 50ms for first timer tick
      setPositionMs(startOffset * 1000 * tempoRef.current);
      console.log(`[SynthPlayer] play() — initial positionMs=${(startOffset * 1000 * tempoRef.current).toFixed(0)}ms, ctxTime=${getAudioContext().currentTime.toFixed(3)}`);
      setIsPlaying(true);
      isPlayingRef.current = true;
      startTimer();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Synth playback failed";
      setError(msg);
      console.error("[useSynthPlayer] play error:", e);
    }
  }, [notes, positionMs, rawDurationMs, scheduleFromOffset, startTimer]);

  const pause = useCallback(async () => {
    console.log("[SynthPlayer] pause() called");
    // Stop the timer guard immediately — prevents a rogue tick from double-counting elapsed
    // after we update playbackOffsetSec.current below.
    isPlayingRef.current = false;
    // Capture elapsed time (wall clock always advances, even after AudioContext suspend)
    const elapsed = getCurrentTime() - audioStartCtxSec.current;
    const currentSec = playbackOffsetSec.current + elapsed;
    playbackOffsetSec.current = currentSec;
    setPositionMs(currentSec * 1000);

    await stopAll();
    stopTimer();
    // Sever the bus so notes scheduled ahead can't burst when the app foregrounds
    // (this listener-driven pause is what runs on background). play() rebuilds it.
    disconnectMasterBus();
    setIsPlaying(false);
  }, [stopTimer]);

  const stop = useCallback(async () => {
    console.log("[SynthPlayer] stop() called");
    isPlayingRef.current = false;  // block timer immediately
    await stopAll();
    stopTimer();
    disconnectMasterBus();
    setIsPlaying(false);
    setPositionMs(0);
    playbackOffsetSec.current = 0;
  }, [stopTimer]);

  const seekTo = useCallback(
    async (ms: number) => {
      const currentDurationMs = rawDurationMs / tempoRef.current;
      const clampedMs = Math.max(0, Math.min(ms, currentDurationMs));
      setPositionMs(clampedMs);
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
    [rawDurationMs, scheduleFromOffset, startTimer, stopTimer],
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
        const elapsed = getCurrentTime() - audioStartCtxSec.current;
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
        const elapsed = getCurrentTime() - audioStartCtxSec.current;
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

  // Pause playback when app backgrounds
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && isPlayingRef.current) {
        pause();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [pause]);

  // Cleanup on unmount — destroy AudioContext here (the only place it should be closed)
  useEffect(() => {
    return () => {
      console.log("[SynthPlayer] cleanup — unmounting, destroying audio context");
      stopTimer();
      destroyAudioContext();
    };
  }, [stopTimer]);

  return {
    isPlaying,
    positionMs,
    durationMs,
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
