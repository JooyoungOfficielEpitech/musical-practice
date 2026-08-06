import { useState, useCallback, useEffect } from "react";
import { Audio } from "expo-av";

interface UseAudioPermissionReturn {
  hasPermission: boolean;
  isRequesting: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
}

export function useAudioPermission(): UseAudioPermissionReturn {
  const [hasPermission, setHasPermission] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setIsRequesting(true);
      setError(null);
      console.log("[AudioPermission] Requesting microphone permission");

      const { status } = await Audio.requestPermissionsAsync();
      const granted = status === "granted";
      setHasPermission(granted);

      if (!granted) {
        setError("Microphone permission denied");
      }

      console.log("[AudioPermission] Permission status:", status);
      return granted;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to request permission";
      console.error("[AudioPermission] Error:", e);
      setError(msg);
      setHasPermission(false);
      return false;
    } finally {
      setIsRequesting(false);
    }
  }, []);

  // Check permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const { status } = await Audio.getPermissionsAsync();
        setHasPermission(status === "granted");
      } catch (e) {
        console.error("[AudioPermission] Error checking permission:", e);
      }
    };
    checkPermission();
  }, []);

  return {
    hasPermission,
    isRequesting,
    error,
    requestPermission,
  };
}
