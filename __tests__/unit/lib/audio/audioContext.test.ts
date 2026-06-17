import {
  getAudioContext,
  getMasterGain,
  registerSource,
  resetMasterGain,
  stopAllSources,
  disconnectMasterBus,
  pruneEndedSources,
  closeAudioContext,
} from "../../../../client/lib/audio/audioContext";

// react-native-audio-api is auto-mocked from __mocks__/

/** Build a fake scheduled source (oscillator / buffer source) with a stop spy. */
const makeSource = () => ({ stop: jest.fn(), start: jest.fn() });

describe("audioContext — master bus + source registry", () => {
  beforeEach(async () => {
    await closeAudioContext();
  });

  describe("getMasterGain", () => {
    it("creates a single gain node connected to the destination", () => {
      const ctx = getAudioContext();
      const master = getMasterGain();

      expect(master).toBeDefined();
      expect(master.connect).toHaveBeenCalledWith(ctx.destination);
      // initialised to full volume
      expect(master.gain.setValueAtTime).toHaveBeenCalledWith(1, expect.any(Number));
    });

    it("returns the same instance across calls (singleton per context)", () => {
      const a = getMasterGain();
      const b = getMasterGain();
      expect(a).toBe(b);
    });

    it("rebuilds the bus after the context is recreated", async () => {
      const first = getMasterGain();
      await closeAudioContext();
      const second = getMasterGain();
      expect(second).not.toBe(first);
    });
  });

  describe("stopAllSources", () => {
    it("ramps the master gain down to zero (declick fade) without suspending", () => {
      getAudioContext();
      const master = getMasterGain();

      stopAllSources(0.012);

      // fade target is 0, reached shortly after 'now'
      const ramps = (master.gain.linearRampToValueAtTime as jest.Mock).mock.calls;
      expect(ramps.some((c) => c[0] === 0)).toBe(true);
    });

    it("hard-stops every live source EARLY at the fade end (not at its natural end)", () => {
      const ctx = getAudioContext();
      (ctx as { currentTime: number }).currentTime = 1.0;
      const a = makeSource();
      const b = makeSource();
      registerSource(a, 5.0); // natural end far in the future
      registerSource(b, 5.0);

      stopAllSources(0.012);

      // stop must be scheduled at fadeEnd (now + fade = 1.012), i.e. cut short —
      // NOT at the 5.0 natural end. This is the whole point of the immediate stop.
      expect(a.stop).toHaveBeenCalledTimes(1);
      expect(a.stop.mock.calls[0][0]).toBeCloseTo(1.012, 5);
      expect(b.stop.mock.calls[0][0]).toBeCloseTo(1.012, 5);
    });

    it("clears the registry so a source is not stopped twice", () => {
      getAudioContext();
      const a = makeSource();
      registerSource(a, 5.0);

      stopAllSources();
      stopAllSources();

      expect(a.stop).toHaveBeenCalledTimes(1);
    });

    it("does not throw when a source.stop() throws (already stopped)", () => {
      getAudioContext();
      const bad = { stop: jest.fn(() => { throw new Error("already stopped"); }) };
      registerSource(bad, 5.0);

      expect(() => stopAllSources()).not.toThrow();
    });

    it("skips sources that already finished long ago", () => {
      const ctx = getAudioContext();
      (ctx as { currentTime: number }).currentTime = 10.0;
      const stale = makeSource();
      registerSource(stale, 1.0); // ended 9s ago

      stopAllSources();

      expect(stale.stop).not.toHaveBeenCalled();
    });
  });

  describe("resetMasterGain", () => {
    it("restores the bus to full volume after a stop fade", () => {
      getAudioContext();
      const master = getMasterGain();
      stopAllSources();
      (master.gain.setValueAtTime as jest.Mock).mockClear();

      resetMasterGain();

      // cancelAndHoldAtTime (not cancelScheduledValues) so an in-progress fade is
      // actually cancelled before restoring volume — otherwise replay plays silent.
      expect(master.gain.cancelAndHoldAtTime).toHaveBeenCalled();
      expect(master.gain.setValueAtTime).toHaveBeenCalledWith(1, expect.any(Number));
    });
  });

  describe("disconnectMasterBus", () => {
    it("disconnects the bus from the output so resumed sources can't reach the speakers", () => {
      getAudioContext();
      const master = getMasterGain();

      disconnectMasterBus();

      expect(master.disconnect).toHaveBeenCalled();
    });

    it("rebuilds a fresh, reconnected bus on the next getMasterGain (so play() reconnects)", () => {
      getAudioContext();
      const first = getMasterGain();

      disconnectMasterBus();
      const second = getMasterGain();

      expect(second).not.toBe(first);
      expect(second.connect).toHaveBeenCalled();
    });

    it("clears the source registry so stale sources are not stopped after teardown", () => {
      getAudioContext();
      const a = makeSource();
      registerSource(a, 5.0);

      disconnectMasterBus();
      stopAllSources();

      expect(a.stop).not.toHaveBeenCalled();
    });

    it("does not throw when there is no master bus yet", () => {
      expect(() => disconnectMasterBus()).not.toThrow();
    });
  });

  describe("pruneEndedSources", () => {
    it("drops sources whose end time has passed, keeps live ones", () => {
      const ctx = getAudioContext();
      (ctx as { currentTime: number }).currentTime = 3.0;
      const ended = makeSource();
      const live = makeSource();
      registerSource(ended, 1.0); // already over
      registerSource(live, 9.0); // still playing

      pruneEndedSources();
      stopAllSources();

      expect(ended.stop).not.toHaveBeenCalled();
      expect(live.stop).toHaveBeenCalled();
    });
  });

  describe("closeAudioContext", () => {
    it("clears the master bus and registry", async () => {
      getAudioContext();
      const a = makeSource();
      registerSource(a, 5.0);

      await closeAudioContext();

      // new context, fresh registry: the old source is gone
      getAudioContext();
      stopAllSources();
      expect(a.stop).not.toHaveBeenCalled();
    });
  });
});
