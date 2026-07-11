const mockCheck = jest.fn();
const mockFetch = jest.fn();
const mockReload = jest.fn();
let mockIsEnabled = true;

jest.mock("expo-updates", () => ({
  get isEnabled() {
    return mockIsEnabled;
  },
  checkForUpdateAsync: (...a: unknown[]) => mockCheck(...a),
  fetchUpdateAsync: (...a: unknown[]) => mockFetch(...a),
  reloadAsync: (...a: unknown[]) => mockReload(...a),
}));

import { applyPendingUpdate } from "../../../client/lib/otaUpdate";

beforeEach(() => {
  jest.clearAllMocks();
  mockIsEnabled = true;
  (global as any).__DEV__ = false;
});

afterEach(() => {
  (global as any).__DEV__ = true;
});

describe("applyPendingUpdate", () => {
  it("fetches and reloads when an update is available", async () => {
    mockCheck.mockResolvedValue({ isAvailable: true });
    mockFetch.mockResolvedValue({});
    mockReload.mockResolvedValue(undefined);

    await applyPendingUpdate();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it("does nothing when no update is available", async () => {
    mockCheck.mockResolvedValue({ isAvailable: false });

    await applyPendingUpdate();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockReload).not.toHaveBeenCalled();
  });

  it("skips entirely when updates are disabled (dev client)", async () => {
    mockIsEnabled = false;

    await applyPendingUpdate();

    expect(mockCheck).not.toHaveBeenCalled();
  });

  it("swallows network errors — stale bundle keeps working", async () => {
    mockCheck.mockRejectedValue(new Error("offline"));

    await expect(applyPendingUpdate()).resolves.toBeUndefined();
    expect(mockReload).not.toHaveBeenCalled();
  });
});
