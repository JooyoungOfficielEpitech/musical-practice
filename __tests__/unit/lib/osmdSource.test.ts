const mockDownloadAsync = jest.fn();
let mockLocalUri: string | null = "file:///bundle/osmd.jslib";

jest.mock("expo-asset", () => ({
  Asset: {
    fromModule: jest.fn(() => ({
      downloadAsync: mockDownloadAsync,
      get localUri() {
        return mockLocalUri;
      },
    })),
  },
}));

const mockText = jest.fn();
jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation(() => ({
    text: mockText,
  })),
}));

describe("getOsmdSource", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockLocalUri = "file:///bundle/osmd.jslib";
    mockDownloadAsync.mockResolvedValue(undefined);
  });

  function load() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../../../client/lib/osmdSource") as typeof import("../../../client/lib/osmdSource");
  }

  it("returns the bundled OSMD source", async () => {
    mockText.mockResolvedValue("var osmd_bundle = 1;");

    const js = await load().getOsmdSource();

    expect(js).toBe("var osmd_bundle = 1;");
  });

  it("caches the source — the asset is only read once", async () => {
    mockText.mockResolvedValue("var osmd_bundle = 1;");
    const { getOsmdSource } = load();

    await getOsmdSource();
    await getOsmdSource();

    expect(mockText).toHaveBeenCalledTimes(1);
  });

  it("escapes closing script tags so inlining can't break the HTML", async () => {
    mockText.mockResolvedValue('var s = "</script>";');

    const js = await load().getOsmdSource();

    expect(js).not.toContain("</script>");
    expect(js).toContain("<\\/script>");
  });

  it("returns null (CDN fallback) when the asset cannot be read", async () => {
    mockText.mockRejectedValue(new Error("asset missing"));

    const js = await load().getOsmdSource();

    expect(js).toBeNull();
  });

  it("retries after a failure instead of caching null forever", async () => {
    const { getOsmdSource } = load();
    mockText.mockRejectedValueOnce(new Error("transient"));
    expect(await getOsmdSource()).toBeNull();

    mockText.mockResolvedValue("var osmd_bundle = 2;");
    expect(await getOsmdSource()).toBe("var osmd_bundle = 2;");
  });
});
