import {
  createPianoNote,
  schedulePianoNotes,
} from "../../../../client/lib/audio/pianoSamples";

const mockOscillators: {
  type: string;
  frequency: { setValueAtTime: jest.Mock };
  connect: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
}[] = [];

const mockGainNodes: {
  gain: { setValueAtTime: jest.Mock; linearRampToValueAtTime: jest.Mock };
  connect: jest.Mock;
}[] = [];

const mockCtx = {
  currentTime: 0,
  sampleRate: 44100,
  destination: {},
  createOscillator: jest.fn(() => {
    const osc = {
      type: "sine",
      frequency: { value: 440, setValueAtTime: jest.fn() },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };
    mockOscillators.push(osc);
    return osc;
  }),
  createGain: jest.fn(() => {
    const gain = {
      gain: {
        value: 1,
        setValueAtTime: jest.fn(),
        linearRampToValueAtTime: jest.fn(),
      },
      connect: jest.fn(),
    };
    mockGainNodes.push(gain);
    return gain;
  }),
};

const mockMasterGain = { connect: jest.fn(), gain: { value: 1 } };
const mockRegisterSource = jest.fn();

jest.mock("../../../../client/lib/audio/audioContext", () => ({
  getAudioContext: () => mockCtx,
  getMasterGain: () => mockMasterGain,
  registerSource: (...args: unknown[]) => mockRegisterSource(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockOscillators.length = 0;
  mockGainNodes.length = 0;
  mockCtx.currentTime = 0;
});

describe("pianoSamples", () => {
  describe("createPianoNote", () => {
    it("creates multiple oscillators for harmonics", () => {
      createPianoNote(440, 1.0, 0, 80);

      // 6 harmonics defined in PIANO_HARMONICS + 1 master gain
      expect(mockOscillators.length).toBeGreaterThanOrEqual(1);
      // Each harmonic gets an oscillator
      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });

    it("creates a master gain node for velocity control", () => {
      createPianoNote(440, 1.0, 0, 80);

      // At least one gain node (master) should be created
      expect(mockCtx.createGain).toHaveBeenCalled();
    });

    it("sets oscillator frequencies to harmonic multiples", () => {
      createPianoNote(440, 1.0, 0, 80);

      // Check that harmonic frequencies are set
      const freqValues = mockOscillators.map(
        (osc) => osc.frequency.setValueAtTime.mock.calls[0]?.[0],
      );

      // Fundamental should be 440
      expect(freqValues).toContain(440);
      // 2nd harmonic should be 880
      expect(freqValues).toContain(880);
      // 3rd harmonic should be 1320
      expect(freqValues).toContain(1320);
    });

    it("all oscillators use sine wave type", () => {
      createPianoNote(440, 1.0, 0, 80);

      for (const osc of mockOscillators) {
        expect(osc.type).toBe("sine");
      }
    });

    it("starts and stops all oscillators", () => {
      createPianoNote(440, 1.0, 0, 80);

      for (const osc of mockOscillators) {
        expect(osc.start).toHaveBeenCalled();
        expect(osc.stop).toHaveBeenCalled();
      }
    });

    it("stops oscillators at the note end time", () => {
      const startTime = 1.0;
      const duration = 2.0;
      createPianoNote(440, duration, startTime, 80);

      for (const osc of mockOscillators) {
        expect(osc.stop).toHaveBeenCalledWith(startTime + duration);
      }
    });

    it("connects oscillators through gain nodes to master", () => {
      createPianoNote(440, 1.0, 0, 80);

      // Each oscillator connects to a harmonic gain node
      for (const osc of mockOscillators) {
        expect(osc.connect).toHaveBeenCalled();
      }
    });

    it("feeds the per-note gain into the shared master bus (not destination directly)", () => {
      createPianoNote(440, 1.0, 0, 80);

      // the per-note gain (first gain created) connects to the master bus
      expect(mockGainNodes[0].connect).toHaveBeenCalledWith(mockMasterGain);
    });

    it("registers every oscillator so it can be hard-stopped on stop()", () => {
      createPianoNote(440, 1.0, 0, 80);

      // one registration per harmonic oscillator
      expect(mockRegisterSource).toHaveBeenCalledTimes(mockOscillators.length);
      // registered with its note-end time (startTime + duration = 1.0)
      for (const call of mockRegisterSource.mock.calls) {
        expect(call[1]).toBeCloseTo(1.0, 5);
      }
    });

    it("maps velocity to gain (higher velocity = louder)", () => {
      // Low velocity
      createPianoNote(440, 1.0, 0, 20);
      const lowGainCalls = mockGainNodes[0].gain.linearRampToValueAtTime.mock.calls;
      const lowPeak = Math.max(...lowGainCalls.map((c: [number, number]) => c[0]));

      jest.clearAllMocks();
      mockGainNodes.length = 0;
      mockOscillators.length = 0;

      // High velocity
      createPianoNote(440, 1.0, 0, 127);
      const highGainCalls = mockGainNodes[0].gain.linearRampToValueAtTime.mock.calls;
      const highPeak = Math.max(...highGainCalls.map((c: [number, number]) => c[0]));

      expect(highPeak).toBeGreaterThan(lowPeak);
    });

    it("skips harmonics above Nyquist frequency", () => {
      // Very high frequency where some harmonics exceed sampleRate/2
      const highFreq = 10000; // 10kHz — 3rd harmonic at 30kHz > 22050 (Nyquist)
      createPianoNote(highFreq, 1.0, 0, 80);

      // Fewer oscillators because high harmonics are skipped
      const freqValues = mockOscillators.map(
        (osc) => osc.frequency.setValueAtTime.mock.calls[0]?.[0],
      );
      for (const freq of freqValues) {
        expect(freq).toBeLessThanOrEqual(mockCtx.sampleRate / 2);
      }
    });
  });

  describe("schedulePianoNotes", () => {
    it("returns baseTime when notes array is empty", () => {
      const endTime = schedulePianoNotes([]);
      expect(endTime).toBeCloseTo(0.1, 3);
    });

    it("schedules multiple notes and returns end time of last note", () => {
      const notes = [
        { frequency: 440, duration: 0.5, startTime: 0, velocity: 80 },
        { frequency: 494, duration: 0.5, startTime: 0.5, velocity: 80 },
        { frequency: 523, duration: 1.0, startTime: 1.0, velocity: 80 },
      ];

      const endTime = schedulePianoNotes(notes);
      // baseTime=0.1, last note at 0.1+1.0=1.1, ends at 1.1+1.0=2.1
      expect(endTime).toBeCloseTo(2.1, 3);
    });

    it("uses custom offset", () => {
      const notes = [
        { frequency: 440, duration: 1.0, startTime: 0, velocity: 80 },
      ];

      const endTime = schedulePianoNotes(notes, 0.5);
      expect(endTime).toBeCloseTo(1.5, 3);
    });

    it("creates oscillators for each note", () => {
      const notes = [
        { frequency: 440, duration: 0.5, startTime: 0, velocity: 80 },
        { frequency: 523, duration: 0.5, startTime: 0.5, velocity: 80 },
      ];

      schedulePianoNotes(notes);
      // Each note creates multiple oscillators for harmonics
      expect(mockOscillators.length).toBeGreaterThan(2);
    });
  });
});
