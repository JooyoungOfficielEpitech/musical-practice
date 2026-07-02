import {
  dlog,
  getDebugEntries,
  clearDebugLog,
  dumpDebugLog,
  subscribeDebugLog,
} from "../../../client/lib/debug/debugLog";

describe("debugLog ring buffer", () => {
  beforeEach(() => clearDebugLog());

  it("records entries with tag and inline data", () => {
    dlog("player", "play", { offset: 1.234, notes: 42 });
    const e = getDebugEntries();
    expect(e).toHaveLength(1);
    expect(e[0].tag).toBe("player");
    expect(e[0].msg).toContain("play");
    expect(e[0].msg).toContain("notes=42");
  });

  it("caps the buffer at 300 entries, dropping the oldest", () => {
    for (let i = 0; i < 320; i++) dlog("t", `m${i}`);
    const e = getDebugEntries();
    expect(e).toHaveLength(300);
    expect(e[0].msg).toBe("m20");
  });

  it("notifies subscribers and supports unsubscribe", () => {
    const fn = jest.fn();
    const unsub = subscribeDebugLog(fn);
    dlog("t", "one");
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
    dlog("t", "two");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("dump includes header fields and all events", () => {
    dlog("load", "xml parsed", { parts: 5 });
    const dump = dumpDebugLog({ sheet: "sheet-1", version: "1.0.0" });
    expect(dump).toContain("sheet: sheet-1");
    expect(dump).toContain("[load] xml parsed parts=5");
  });
});
