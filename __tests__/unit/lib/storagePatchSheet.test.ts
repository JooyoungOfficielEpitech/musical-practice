import AsyncStorage from "@react-native-async-storage/async-storage";
import { patchSheet, type SheetMusic } from "../../../client/lib/storage";

jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => void store.set(k, v)),
      removeItem: jest.fn(async (k: string) => void store.delete(k)),
      clear: jest.fn(async () => void store.clear()),
    },
  };
});

const sheet = (over: Partial<SheetMusic>): SheetMusic => ({
  id: "s1",
  title: "Score",
  artist: "",
  imageUris: [],
  createdAt: 1,
  folder: "Musical",
  isFavorite: false,
  ...over,
});

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe("patchSheet", () => {
  it("merges the patch into the stored sheet and returns it", async () => {
    await AsyncStorage.setItem(
      "@musicalpractice/sheets",
      JSON.stringify([sheet({ id: "s1", omrStatus: "processing" }), sheet({ id: "s2" })]),
    );

    const patched = await patchSheet("s1", { omrStatus: "ready", musicXmlUri: "file:///x" });

    expect(patched?.omrStatus).toBe("ready");
    expect(patched?.musicXmlUri).toBe("file:///x");
    expect(patched?.title).toBe("Score");

    const stored = JSON.parse((await AsyncStorage.getItem("@musicalpractice/sheets"))!);
    expect(stored[0].omrStatus).toBe("ready");
    expect(stored[1].id).toBe("s2");
    expect(stored[1].omrStatus).toBeUndefined();
  });

  it("returns null for an unknown id and leaves storage untouched", async () => {
    await AsyncStorage.setItem(
      "@musicalpractice/sheets",
      JSON.stringify([sheet({ id: "s1" })]),
    );

    const patched = await patchSheet("nope", { omrStatus: "ready" });

    expect(patched).toBeNull();
    const stored = JSON.parse((await AsyncStorage.getItem("@musicalpractice/sheets"))!);
    expect(stored).toHaveLength(1);
    expect(stored[0].omrStatus).toBeUndefined();
  });
});

describe("patchSheet — concurrent writes", () => {
  it("serializes concurrent patches so neither update is lost", async () => {
    await AsyncStorage.setItem(
      "@musicalpractice/sheets",
      JSON.stringify([sheet({ id: "s1" }), sheet({ id: "s2" })]),
    );

    // Fire two patches on different sheets without awaiting in between —
    // without write serialization both read the same snapshot and the
    // last writer wins, losing the other's update.
    const [a, b] = await Promise.all([
      patchSheet("s1", { omrProgress: 55 }),
      patchSheet("s2", { omrStatus: "ready" }),
    ]);

    expect(a?.omrProgress).toBe(55);
    expect(b?.omrStatus).toBe("ready");

    const stored = JSON.parse((await AsyncStorage.getItem("@musicalpractice/sheets"))!);
    expect(stored.find((s: any) => s.id === "s1").omrProgress).toBe(55);
    expect(stored.find((s: any) => s.id === "s2").omrStatus).toBe("ready");
  });

  it("serializes concurrent patches on the SAME sheet (both fields survive)", async () => {
    await AsyncStorage.setItem(
      "@musicalpractice/sheets",
      JSON.stringify([sheet({ id: "s1" })]),
    );

    await Promise.all([
      patchSheet("s1", { omrProgress: 80 }),
      patchSheet("s1", { musicXmlUri: "file:///x" }),
    ]);

    const stored = JSON.parse((await AsyncStorage.getItem("@musicalpractice/sheets"))!);
    expect(stored[0].omrProgress).toBe(80);
    expect(stored[0].musicXmlUri).toBe("file:///x");
  });
});
