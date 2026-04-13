import { AudioBuffer } from "react-native-audio-api";
import {
  findClosestSample,
  playSample,
  scheduleNotesWithSamples,
} from "../../../../client/lib/audio/samplePlayer";
import type { NoteEvent } from "../../../../client/types/music";

// Mock synthEngine to provide a controlled AudioContext
const mockCtx = {
  currentTime: 0,
  destination: {},
  createBufferSource: jest.fn(() => ({
    buffer: null,
    playbackRate: { value: 1, setValueAtTime: jest.fn() },
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  })),
  createGain: jest.fn(() => ({
    gain: {
      value: 1,
      setValueAtTime: jest.fn(),
      linearRampToValueAtTime: jest.fn(),
    },
    connect: jest.fn(),
  })),
};

jest.mock("../../../../client/lib/audio/audioContext", () => ({
  getAudioContext: () => mockCtx,
}));

function createMockBuffer(): AudioBuffer {
  return new AudioBuffer({} as any);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCtx.currentTime = 0;
});

describe("samplePlayer", () => {
  describe("findClosestSample", () => {
    it("returns null for empty sample map", () => {
      const samples = new Map<number, AudioBuffer>();
      expect(findClosestSample(60, samples)).toBeNull();
    });

    it("returns exact match with playbackRate 1.0", () => {
      const samples = new Map<number, AudioBuffer>();
      samples.set(60, createMockBuffer());

      const result = findClosestSample(60, samples);
      expect(result).not.toBeNull();
      expect(result!.sampleMidi).toBe(60);
      expect(result!.playbackRate).toBe(1.0);
    });

    it("finds closest lower sample and calculates pitch-up rate", () => {
      const samples = new Map<number, AudioBuffer>();
      samples.set(60, createMockBuffer()); // C4

      const result = findClosestSample(62, samples); // D4 = 2 semitones up
      expect(result).not.toBeNull();
      expect(result!.sampleMidi).toBe(60);
      // 2 semitones up: rate = 2^(2/12)
      expect(result!.playbackRate).toBeCloseTo(Math.pow(2, 2 / 12), 6);
    });

    it("finds closest higher sample and calculates pitch-down rate", () => {
      const samples = new Map<number, AudioBuffer>();
      samples.set(67, createMockBuffer()); // G4

      const result = findClosestSample(65, samples); // F4 = 2 semitones down
      expect(result).not.toBeNull();
      expect(result!.sampleMidi).toBe(67);
      expect(result!.playbackRate).toBeCloseTo(Math.pow(2, -2 / 12), 6);
    });

    it("chooses the closest sample when multiple are available", () => {
      const samples = new Map<number, AudioBuffer>();
      samples.set(48, createMockBuffer()); // C3
      samples.set(60, createMockBuffer()); // C4
      samples.set(72, createMockBuffer()); // C5

      // Target 63 (D#4) is closest to 60 (3 semitones away vs 9 from 72)
      const result = findClosestSample(63, samples);
      expect(result!.sampleMidi).toBe(60);
    });

    it("returns correct playbackRate for 1 semitone difference", () => {
      const samples = new Map<number, AudioBuffer>();
      samples.set(60, createMockBuffer());

      const result = findClosestSample(61, samples);
      // 1 semitone = 2^(1/12)
      expect(result!.playbackRate).toBeCloseTo(Math.pow(2, 1 / 12), 6);
    });

    it("returns correct playbackRate for octave difference", () => {
      const samples = new Map<number, AudioBuffer>();
      samples.set(60, createMockBuffer());

      const result = findClosestSample(72, samples);
      // 12 semitones = 2^(12/12) = 2.0
      expect(result!.playbackRate).toBeCloseTo(2.0, 6);
    });
  });

  describe("playSample", () => {
    it("creates a buffer source node and gain node", () => {
      const buffer = createMockBuffer();
      playSample(buffer, 0, 1.0, 80, 1.0);

      expect(mockCtx.createBufferSource).toHaveBeenCalled();
      expect(mockCtx.createGain).toHaveBeenCalled();
    });

    it("sets playbackRate on the source node", () => {
      const buffer = createMockBuffer();
      playSample(buffer, 0, 1.0, 80, 1.5);

      const source = mockCtx.createBufferSource.mock.results[0].value;
      expect(source.playbackRate.setValueAtTime).toHaveBeenCalledWith(1.5, 0);
    });

    it("starts the source at the specified time", () => {
      const buffer = createMockBuffer();
      playSample(buffer, 0.5, 1.0, 80, 1.0);

      const source = mockCtx.createBufferSource.mock.results[0].value;
      expect(source.start).toHaveBeenCalledWith(0.5, 0, 1.0);
    });

    it("connects source -> gain -> destination", () => {
      const buffer = createMockBuffer();
      playSample(buffer, 0, 1.0, 80, 1.0);

      const source = mockCtx.createBufferSource.mock.results[0].value;
      const gain = mockCtx.createGain.mock.results[0].value;
      expect(source.connect).toHaveBeenCalledWith(gain);
      expect(gain.connect).toHaveBeenCalledWith(mockCtx.destination);
    });

    it("maps velocity 127 to gain 1.0", () => {
      const buffer = createMockBuffer();
      playSample(buffer, 0, 1.0, 127, 1.0);

      const gain = mockCtx.createGain.mock.results[0].value;
      // Should ramp to gain=1.0 (127/127)
      const rampCalls = gain.gain.linearRampToValueAtTime.mock.calls;
      expect(rampCalls.some((c: [number, number]) => Math.abs(c[0] - 1.0) < 0.01)).toBe(true);
    });

    it("maps velocity 0 to gain 0", () => {
      const buffer = createMockBuffer();
      playSample(buffer, 0, 1.0, 0, 1.0);

      const gain = mockCtx.createGain.mock.results[0].value;
      // All ramp values should be 0
      const rampCalls = gain.gain.linearRampToValueAtTime.mock.calls;
      for (const [value] of rampCalls) {
        expect(value).toBeCloseTo(0, 5);
      }
    });
  });

  describe("scheduleNotesWithSamples", () => {
    it("returns baseTime when notes array is empty", () => {
      const samples = new Map<number, AudioBuffer>();
      const endTime = scheduleNotesWithSamples([], samples);
      // baseTime = currentTime(0) + offset(0.1) = 0.1
      expect(endTime).toBeCloseTo(0.1, 3);
    });

    it("schedules notes and returns correct end time", () => {
      const samples = new Map<number, AudioBuffer>();
      samples.set(60, createMockBuffer());

      const notes: NoteEvent[] = [
        { pitch: "C4", midiNumber: 60, frequency: 261.63, startTime: 0, duration: 0.5, velocity: 80 },
        { pitch: "C4", midiNumber: 60, frequency: 261.63, startTime: 0.5, duration: 0.5, velocity: 80 },
      ];

      const endTime = scheduleNotesWithSamples(notes, samples);
      // baseTime=0.1, last note starts at 0.1+0.5=0.6, ends at 0.6+0.5=1.1
      expect(endTime).toBeCloseTo(1.1, 3);
    });

    it("skips notes with no matching sample", () => {
      const samples = new Map<number, AudioBuffer>();
      // No samples loaded

      const notes: NoteEvent[] = [
        { pitch: "C4", midiNumber: 60, frequency: 261.63, startTime: 0, duration: 0.5, velocity: 80 },
      ];

      const endTime = scheduleNotesWithSamples(notes, samples);
      // No notes scheduled, just baseTime
      expect(endTime).toBeCloseTo(0.1, 3);
    });

    it("uses custom offset", () => {
      const samples = new Map<number, AudioBuffer>();
      samples.set(60, createMockBuffer());

      const notes: NoteEvent[] = [
        { pitch: "C4", midiNumber: 60, frequency: 261.63, startTime: 0, duration: 1.0, velocity: 80 },
      ];

      const endTime = scheduleNotesWithSamples(notes, samples, 0.5);
      // baseTime = 0 + 0.5, note ends at 0.5 + 0 + 1.0 = 1.5
      expect(endTime).toBeCloseTo(1.5, 3);
    });

    it("schedules simultaneous chord notes", () => {
      const samples = new Map<number, AudioBuffer>();
      samples.set(60, createMockBuffer());
      samples.set(64, createMockBuffer());
      samples.set(67, createMockBuffer());

      const notes: NoteEvent[] = [
        { pitch: "C4", midiNumber: 60, frequency: 261.63, startTime: 0, duration: 0.5, velocity: 80 },
        { pitch: "E4", midiNumber: 64, frequency: 329.63, startTime: 0, duration: 0.5, velocity: 80 },
        { pitch: "G4", midiNumber: 67, frequency: 392.0, startTime: 0, duration: 0.5, velocity: 80 },
      ];

      const endTime = scheduleNotesWithSamples(notes, samples);
      // All notes end at the same time: 0.1 + 0 + 0.5 = 0.6
      expect(endTime).toBeCloseTo(0.6, 3);
      // 3 buffer source nodes created
      expect(mockCtx.createBufferSource).toHaveBeenCalledTimes(3);
    });
  });
});
