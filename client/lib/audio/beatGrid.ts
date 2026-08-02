/**
 * beatGrid — extracts the metronome beat timeline from MusicXML.
 *
 * Uses the SAME shared bar grid the audio parser lays notes on (fixed bar
 * lengths from time signatures, repeats expanded identically), so clicks can
 * never drift from the scheduled notes.
 */
import type { NoteEvent } from "../../types/music";
import {
  getAllMatches,
  parseTempo,
  parseBarBeats,
  expandRepeats,
} from "./musicXmlParser";

export interface BeatEvent {
  timeSec: number;
  isDownbeat: boolean;
}

export interface BeatGrid {
  bpm: number;
  beats: BeatEvent[];
}

const DEFAULT_BAR_BEATS = 4;

// Click voicing: very short high piano notes read as clicks. The downbeat is
// higher-pitched and louder so the bar start is audible at a glance.
const CLICK_DURATION_SEC = 0.05;
const DOWNBEAT_MIDI = 108; // C8
const DOWNBEAT_FREQ = 4186.01;
const DOWNBEAT_VELOCITY = 112;
const OFFBEAT_MIDI = 103; // G7
const OFFBEAT_FREQ = 3135.96;
const OFFBEAT_VELOCITY = 78;

/** Build the beat timeline (with downbeat accents) for a MusicXML score. */
export function buildBeatGrid(xmlString: string): BeatGrid {
  const bpm = parseTempo(xmlString);
  const secondsPerBeat = 60 / bpm;

  // Bar lengths come from whichever part declares a <time> for that measure —
  // sticky across measures, shared by all parts (same rule as the note parser).
  const partMatches = [...xmlString.matchAll(/<part\b[^>]*>([\s\S]*?)<\/part>/g)];
  const allPartXmls = partMatches.length > 0 ? partMatches.map((m) => m[1]) : [xmlString];
  const partMeasures = allPartXmls.map((p) => getAllMatches(p, "measure"));
  const maxMeasures = partMeasures.reduce((mx, ms) => Math.max(mx, ms.length), 0);
  if (maxMeasures === 0) return { bpm, beats: [] };

  const barBeatsByMeasure: number[] = [];
  let stickyBarBeats = DEFAULT_BAR_BEATS;
  for (let mi = 0; mi < maxMeasures; mi++) {
    let found: number | null = null;
    for (const ms of partMeasures) {
      if (mi < ms.length) {
        const b = parseBarBeats(ms[mi]);
        if (b !== null) {
          found = b;
          break;
        }
      }
    }
    if (found !== null) stickyBarBeats = found;
    barBeatsByMeasure[mi] = stickyBarBeats;
  }

  // Expand repeats exactly like the audio timeline, using the longest part.
  const longestPart = partMeasures.reduce(
    (best, ms) => (ms.length > best.length ? ms : best),
    partMeasures[0],
  );
  const measureOrder = expandRepeats(longestPart);

  const beats: BeatEvent[] = [];
  let gridBeat = 0;
  for (const measureIdx of measureOrder) {
    const barBeats = barBeatsByMeasure[measureIdx] ?? DEFAULT_BAR_BEATS;
    for (let b = 0; b < barBeats; b++) {
      beats.push({
        timeSec: (gridBeat + b) * secondsPerBeat,
        isDownbeat: b === 0,
      });
    }
    gridBeat += barBeats;
  }

  return { bpm, beats };
}

/** Turn a beat grid into short click NoteEvents the synth player can schedule. */
export function generateMetronomeEvents(grid: BeatGrid): NoteEvent[] {
  return grid.beats.map((beat) => ({
    pitch: beat.isDownbeat ? "C8" : "G7",
    midiNumber: beat.isDownbeat ? DOWNBEAT_MIDI : OFFBEAT_MIDI,
    frequency: beat.isDownbeat ? DOWNBEAT_FREQ : OFFBEAT_FREQ,
    startTime: beat.timeSec,
    duration: CLICK_DURATION_SEC,
    velocity: beat.isDownbeat ? DOWNBEAT_VELOCITY : OFFBEAT_VELOCITY,
  }));
}
