import { renderHook, act } from "@testing-library/react-native";
import { useAudioPermission } from "../../../client/hooks/useAudioPermission";

const mockRequestPermissionsAsync = jest.fn();
const mockGetPermissionsAsync = jest.fn();

jest.mock("expo-av", () => ({
  Audio: {
    requestPermissionsAsync: () => mockRequestPermissionsAsync(),
    getPermissionsAsync: () => mockGetPermissionsAsync(),
  },
}));

describe("useAudioPermission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: permission not granted
    mockGetPermissionsAsync.mockResolvedValue({ status: "undetermined" });
  });

  describe("initialization", () => {
    it("starts with hasPermission false and isRequesting false", () => {
      const { result } = renderHook(() => useAudioPermission());
      expect(result.current.hasPermission).toBe(false);
      expect(result.current.isRequesting).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("checks permission on mount", async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: "granted" });

      renderHook(() => useAudioPermission());

      await act(async () => {
        // Wait for effect to run
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockGetPermissionsAsync).toHaveBeenCalled();
    });

    it("sets hasPermission true if already granted", async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: "granted" });

      const { result } = renderHook(() => useAudioPermission());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.hasPermission).toBe(true);
    });
  });

  describe("requestPermission", () => {
    it("returns true on granted", async () => {
      mockRequestPermissionsAsync.mockResolvedValue({ status: "granted" });

      const { result } = renderHook(() => useAudioPermission());

      let grantedResult = false;
      await act(async () => {
        grantedResult = await result.current.requestPermission();
      });

      expect(grantedResult).toBe(true);
      expect(result.current.hasPermission).toBe(true);
    });

    it("returns false on denied", async () => {
      mockRequestPermissionsAsync.mockResolvedValue({ status: "denied" });

      const { result } = renderHook(() => useAudioPermission());

      let grantedResult = true;
      await act(async () => {
        grantedResult = await result.current.requestPermission();
      });

      expect(grantedResult).toBe(false);
      expect(result.current.hasPermission).toBe(false);
    });

    it("sets error message on denied", async () => {
      mockRequestPermissionsAsync.mockResolvedValue({ status: "denied" });

      const { result } = renderHook(() => useAudioPermission());

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(result.current.error).toContain("permission denied");
    });

    it("sets isRequesting during request", async () => {
      mockRequestPermissionsAsync.mockResolvedValue({ status: "granted" });

      const { result } = renderHook(() => useAudioPermission());

      await act(async () => {
        await result.current.requestPermission();
      });

      // After request completes, isRequesting should be false
      expect(result.current.isRequesting).toBe(false);
    });

    it("clears previous error on new request", async () => {
      mockRequestPermissionsAsync.mockResolvedValueOnce({ status: "denied" });
      mockRequestPermissionsAsync.mockResolvedValueOnce({ status: "granted" });

      const { result } = renderHook(() => useAudioPermission());

      await act(async () => {
        await result.current.requestPermission();
      });
      expect(result.current.error).not.toBeNull();

      await act(async () => {
        await result.current.requestPermission();
      });
      expect(result.current.error).toBeNull();
    });
  });

  describe("error handling", () => {
    it("handles permission request error", async () => {
      mockRequestPermissionsAsync.mockRejectedValue(new Error("Audio module not available"));

      const { result } = renderHook(() => useAudioPermission());

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(result.current.error).toContain("Audio module not available");
      expect(result.current.hasPermission).toBe(false);
    });

    it("handles permission check error on mount", async () => {
      mockGetPermissionsAsync.mockRejectedValue(new Error("Platform error"));

      const { result } = renderHook(() => useAudioPermission());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Should not crash, just leave hasPermission as false
      expect(result.current.hasPermission).toBe(false);
    });
  });
});
