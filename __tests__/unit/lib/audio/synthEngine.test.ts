import {
  getAudioContext,
  resumeAudioContext,
  playNote,
  scheduleNotes,
  stopAll,
  destroyAudioContext,
  getCurrentTime,
  setInstrumentMode,
} from "../../../../client/lib/audio/synthEngine";
import { getMasterGain } from "../../../../client/lib/audio/audioContext";

// The mock is auto-resolved from __mocks__/react-native-audio-api.ts

describe("synthEngine", () => {
  beforeEach(async () => {
    // Reset module state between tests by fully destroying the context
    await destroyAudioContext();
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

    it("returns same AudioContext after stopAll (context stays running, not closed)", async () => {
      const ctx1 = getAudioContext();
      await stopAll();
      const ctx2 = getAudioContext();
      expect(ctx2).toBe(ctx1); // context survives stopAll, only destroyed by destroyAudioContext
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

    it("routes oscillator -> note gain -> master bus -> destination", () => {
      const ctx = getAudioContext();
      playNote(440, 1.0, 0);

      const oscillator = (ctx.createOscillator as jest.Mock).mock.results[0].value;
      const noteGain = (ctx.createGain as jest.Mock).mock.results[0].value;
      const master = getMasterGain();

      expect(oscillator.connect).toHaveBeenCalledWith(noteGain);
      // note gain feeds the shared master bus, not the destination directly
      expect(noteGain.connect).toHaveBeenCalledWith(master);
      expect(master.connect).toHaveBeenCalledWith(ctx.destination);
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
    it("silences immediately by hard-stopping live notes instead of suspending", async () => {
      const ctx = getAudioContext();
      // schedule a note far in the future so it is still 'live' at stop time
      playNote(440, 1.0, 100);
      const oscillator = (ctx.createOscillator as jest.Mock).mock.results[0].value;
      (oscillator.stop as jest.Mock).mockClear();

      await stopAll();

      // the oscillator is force-stopped EARLY (at fade end ≈ now+0.012), not left to
      // ring out to its scheduled note end of 101 — this is what makes stop immediate
      expect(oscillator.stop).toHaveBeenCalledTimes(1);
      expect(oscillator.stop.mock.calls[0][0]).toBeCloseTo(0.012, 5);
      // the context is NOT suspended (that adds drain latency) and not closed
      expect(ctx.suspend).not.toHaveBeenCalled();
      expect(ctx.close).not.toHaveBeenCalled();
    });

    it("fades the master bus to zero (declick)", async () => {
      const ctx = getAudioContext();
      playNote(440, 1.0, 100);
      const master = getMasterGain();

      await stopAll();

      const ramps = (master.gain.linearRampToValueAtTime as jest.Mock).mock.calls;
      expect(ramps.some((c) => c[0] === 0)).toBe(true);
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

    it("returns currentTime after stopAll (context stays alive)", async () => {
      const ctx = getAudioContext();
      (ctx as any).currentTime = 3.0;
      await stopAll();
      expect(getCurrentTime()).toBe(3.0);
    });
  });
});
