import { renderHook, act } from "@testing-library/react-native";
import { Alert, Platform } from "react-native";
import { useAudioPermission } from "../../client/hooks/useAudioPermission";

// Mock expo-av
const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockSetAudioMode = jest.fn();

jest.mock("expo-av", () => ({
  Audio: {
    getPermissionsAsync: (...args: unknown[]) => mockGetPermissions(...args),
    requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissions(...args),
    setAudioModeAsync: (...args: unknown[]) => mockSetAudioMode(...args),
  },
}));

// Spy on Alert
jest.spyOn(Alert, "alert").mockImplementation();

describe("useAudioPermission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPermissions.mockResolvedValue({ status: "undetermined" });
    mockSetAudioMode.mockResolvedValue(undefined);
    // Ensure not web
    Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
  });

  it("starts with undetermined status", async () => {
    const { result } = renderHook(() => useAudioPermission());

    // Before the async check resolves
    expect(result.current.status).toBe("undetermined");
    expect(result.current.isGranted).toBe(false);
    expect(result.current.isDenied).toBe(false);
  });

  it("checks permission on mount and updates status", async () => {
    mockGetPermissions.mockResolvedValue({ status: "granted" });

    const { result } = renderHook(() => useAudioPermission());

    // Wait for the effect to resolve
    await act(async () => {});

    expect(result.current.status).toBe("granted");
    expect(result.current.isGranted).toBe(true);
  });

  it("requestPermission returns true when granted", async () => {
    mockRequestPermissions.mockResolvedValue({ status: "granted" });

    const { result } = renderHook(() => useAudioPermission());

    let granted = false;
    await act(async () => {
      granted = await result.current.requestPermission();
    });

    expect(granted).toBe(true);
    expect(result.current.isGranted).toBe(true);
  });

  it("requestPermission returns false and shows alert when denied", async () => {
    mockRequestPermissions.mockResolvedValue({ status: "denied" });

    const { result } = renderHook(() => useAudioPermission());

    let granted = true;
    await act(async () => {
      granted = await result.current.requestPermission();
    });

    expect(granted).toBe(false);
    expect(result.current.isDenied).toBe(true);
    expect(Alert.alert).toHaveBeenCalledWith(
      "Microphone Permission Required",
      expect.any(String),
      expect.any(Array),
    );
  });

  it("does NOT call setAudioModeAsync (LiveAudioStream handles audio session)", async () => {
    mockRequestPermissions.mockResolvedValue({ status: "granted" });

    const { result } = renderHook(() => useAudioPermission());

    await act(async () => {
      await result.current.requestPermission();
    });

    // Audio session is managed by react-native-live-audio-stream natively.
    // Calling expo-av's setAudioModeAsync conflicts with LiveAudioStream.
    expect(mockSetAudioMode).not.toHaveBeenCalled();
  });

  it("does NOT configure audio session when denied", async () => {
    mockRequestPermissions.mockResolvedValue({ status: "denied" });

    const { result } = renderHook(() => useAudioPermission());

    await act(async () => {
      await result.current.requestPermission();
    });

    expect(mockSetAudioMode).not.toHaveBeenCalled();
  });

  it("returns false on web platform", async () => {
    Object.defineProperty(Platform, "OS", { value: "web", configurable: true });

    const { result } = renderHook(() => useAudioPermission());

    let granted = true;
    await act(async () => {
      granted = await result.current.requestPermission();
    });

    expect(granted).toBe(false);
  });

  it("handles getPermissionsAsync error gracefully", async () => {
    mockGetPermissions.mockRejectedValue(new Error("unavailable"));

    const { result } = renderHook(() => useAudioPermission());

    await act(async () => {});

    expect(result.current.status).toBe("undetermined");
  });

  it("handles requestPermissionsAsync error gracefully", async () => {
    mockRequestPermissions.mockRejectedValue(new Error("crash"));

    const { result } = renderHook(() => useAudioPermission());

    let granted = true;
    await act(async () => {
      granted = await result.current.requestPermission();
    });

    expect(granted).toBe(false);
    expect(result.current.isDenied).toBe(true);
  });
});
