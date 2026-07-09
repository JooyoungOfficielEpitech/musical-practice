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
