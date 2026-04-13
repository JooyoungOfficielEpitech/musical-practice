import {
  getAudioContext,
  resumeAudioContext,
  playNote,
  scheduleNotes,
  stopAll,
  getCurrentTime,
  setInstrumentMode,
} from "../../../../client/lib/audio/synthEngine";

// The mock is auto-resolved from __mocks__/react-native-audio-api.ts

describe("synthEngine", () => {
  beforeEach(async () => {
    // Reset module state between tests by stopping any previous context
    await stopAll();
    // Use oscillator mode for predictable test assertions (1 oscillator per note)
    setInstrumentMode("oscillator");
  });

  describe("getAudioContext", () => {
    it("creates an AudioContext on first call", () => {
      const ctx = getAudioContext();
      expect(ctx).toBeDefined();
      expect(ctx.state).toBe("running");
    });

    it("returns the same AudioContext on subsequent calls", () => {
      const ctx1 = getAudioContext();
      const ctx2 = getAudioContext();
      expect(ctx1).toBe(ctx2);
    });

    it("creates a new AudioContext after the previous one is closed", async () => {
      const ctx1 = getAudioContext();
      await stopAll();
      const ctx2 = getAudioContext();
      expect(ctx2).not.toBe(ctx1);
    });
  });

  describe("resumeAudioContext", () => {
    it("calls resume when context is suspended", async () => {
      const ctx = getAudioContext();
      (ctx as any).state = "suspended";
      await resumeAudioContext();
      expect(ctx.resume).toHaveBeenCalled();
    });

    it("does not call resume when context is already running", async () => {
      const ctx = getAudioContext();
      (ctx as any).state = "running";
      await resumeAudioContext();
      expect(ctx.resume).not.toHaveBeenCalled();
    });
  });

  describe("playNote", () => {
    it("creates an oscillator and gain node", () => {
      const ctx = getAudioContext();
      playNote(440, 1.0, 0);

      expect(ctx.createOscillator).toHaveBeenCalled();
      expect(ctx.createGain).toHaveBeenCalled();
    });

    it("sets the oscillator frequency", () => {
      const ctx = getAudioContext();
      playNote(261.63, 0.5, 0);

      const oscillator = (ctx.createOscillator as jest.Mock).mock.results[0].value;
      expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(261.63, 0);
    });

    it("connects oscillator to gain and gain to destination", () => {
      const ctx = getAudioContext();
      playNote(440, 1.0, 0);

      const oscillator = (ctx.createOscillator as jest.Mock).mock.results[0].value;
      const gainNode = (ctx.createGain as jest.Mock).mock.results[0].value;

      expect(oscillator.connect).toHaveBeenCalledWith(gainNode);
      expect(gainNode.connect).toHaveBeenCalledWith(ctx.destination);
    });

    it("starts and stops the oscillator at correct times", () => {
      const ctx = getAudioContext();
      playNote(440, 1.0, 2.0);

      const oscillator = (ctx.createOscillator as jest.Mock).mock.results[0].value;
      expect(oscillator.start).toHaveBeenCalledWith(2.0);
      expect(oscillator.stop).toHaveBeenCalledWith(3.0); // startTime + duration
    });

    it("applies gain envelope (starts at 0, ramps up, ramps down to 0)", () => {
      const ctx = getAudioContext();
      playNote(440, 1.0, 0);

      const gainNode = (ctx.createGain as jest.Mock).mock.results[0].value;
      // Starts silent
      expect(gainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
      // Ramps down to 0 at end
      expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 1.0);
    });
  });

  describe("scheduleNotes", () => {
    it("schedules multiple notes and returns the end time", () => {
      const ctx = getAudioContext();
      const notes = [
        { frequency: 261.63, duration: 0.5, startTime: 0 },
        { frequency: 293.66, duration: 0.5, startTime: 0.5 },
        { frequency: 329.63, duration: 1.0, startTime: 1.0 },
      ];

      const endTime = scheduleNotes(notes, 0.1);

      // Last note starts at baseTime(0+0.1) + 1.0 and lasts 1.0s = 2.1
      expect(endTime).toBeCloseTo(2.1, 2);
    });

    it("creates an oscillator for each note", () => {
      const ctx = getAudioContext();
      const notes = [
        { frequency: 440, duration: 0.5, startTime: 0 },
        { frequency: 880, duration: 0.5, startTime: 0.5 },
      ];

      scheduleNotes(notes, 0);
      expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    });

    it("returns baseTime when given an empty array", () => {
      const ctx = getAudioContext();
      const endTime = scheduleNotes([], 0.1);
      expect(endTime).toBeCloseTo(0.1, 2);
    });

    it("uses default offset of 0.1 seconds", () => {
      const ctx = getAudioContext();
      const notes = [{ frequency: 440, duration: 1.0, startTime: 0 }];

      const endTime = scheduleNotes(notes);

      // baseTime = currentTime(0) + 0.1, noteEnd = 0.1 + 0 + 1.0 = 1.1
      expect(endTime).toBeCloseTo(1.1, 2);
    });
  });

  describe("stopAll", () => {
    it("closes the audio context", async () => {
      const ctx = getAudioContext();
      await stopAll();
      expect(ctx.close).toHaveBeenCalled();
    });

    it("is safe to call multiple times", async () => {
      getAudioContext();
      await stopAll();
      await stopAll(); // should not throw
    });
  });

  describe("getCurrentTime", () => {
    it("returns currentTime from the audio context", () => {
      const ctx = getAudioContext();
      (ctx as any).currentTime = 5.5;
      expect(getCurrentTime()).toBe(5.5);
    });

    it("returns 0 when no context exists", async () => {
      await stopAll();
      expect(getCurrentTime()).toBe(0);
    });
  });
});
