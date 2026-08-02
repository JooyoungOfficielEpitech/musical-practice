/**
 * Tests for client/lib/audio/beatGrid.ts
 * Beat grid extraction from MusicXML (for the metronome) and click generation.
 */
import { buildBeatGrid, generateMetronomeEvents } from "../../../../client/lib/audio/beatGrid";
import {
  SAMPLE_MUSICXML,
  SAMPLE_REPEAT_XML,
} from "../../../../client/lib/audio/musicXmlParser";

describe("buildBeatGrid", () => {
  it("produces one beat per quarter note across all measures (4/4, tempo 120)", () => {
    // SAMPLE_MUSICXML: 4 measures of 4/4 at 120bpm → 16 beats, 0.5s apart
    const grid = buildBeatGrid(SAMPLE_MUSICXML);

    expect(grid.bpm).toBe(120);
    expect(grid.beats).toHaveLength(16);
    expect(grid.beats[0].timeSec).toBeCloseTo(0);
    expect(grid.beats[1].timeSec).toBeCloseTo(0.5);
    expect(grid.beats[15].timeSec).toBeCloseTo(7.5);
  });

  it("marks the first beat of each measure as a downbeat", () => {
    const grid = buildBeatGrid(SAMPLE_MUSICXML);
    const downbeatTimes = grid.beats.filter((b) => b.isDownbeat).map((b) => b.timeSec);
    expect(downbeatTimes).toHaveLength(4);
    expect(downbeatTimes[0]).toBeCloseTo(0);
    expect(downbeatTimes[1]).toBeCloseTo(2.0);
  });

  it("expands repeats the same way the audio timeline does", () => {
    // SAMPLE_REPEAT_XML: measure 1 (2/4) repeated, then measure 2 → 3 bars × 2 beats
    const grid = buildBeatGrid(SAMPLE_REPEAT_XML);
    expect(grid.beats).toHaveLength(6);
    const downbeats = grid.beats.filter((b) => b.isDownbeat).map((b) => b.timeSec);
    expect(downbeats[0]).toBeCloseTo(0);
    expect(downbeats[1]).toBeCloseTo(1.0);
    expect(downbeats[2]).toBeCloseTo(2.0);
  });

  it("returns an empty grid for XML without measures", () => {
    const grid = buildBeatGrid("<score-partwise></score-partwise>");
    expect(grid.beats).toHaveLength(0);
  });
});

describe("generateMetronomeEvents", () => {
  it("creates one short click note per beat", () => {
    const grid = buildBeatGrid(SAMPLE_MUSICXML);
    const clicks = generateMetronomeEvents(grid);

    expect(clicks).toHaveLength(16);
    expect(clicks[0].startTime).toBeCloseTo(0);
    expect(clicks[1].startTime).toBeCloseTo(0.5);
    clicks.forEach((c) => {
      expect(c.duration).toBeLessThanOrEqual(0.1);
      expect(c.velocity).toBeGreaterThan(0);
    });
  });

  it("accents downbeats with a distinct pitch and louder velocity", () => {
    const grid = buildBeatGrid(SAMPLE_MUSICXML);
    const clicks = generateMetronomeEvents(grid);
    const downbeat = clicks[0];
    const offbeat = clicks[1];

    expect(downbeat.midiNumber).not.toBe(offbeat.midiNumber);
    expect(downbeat.velocity).toBeGreaterThan(offbeat.velocity);
  });

  it("returns an empty array for an empty grid", () => {
    expect(generateMetronomeEvents({ bpm: 120, beats: [] })).toEqual([]);
  });
});
