import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";

export function useLandscape(): {
  isLandscape: boolean;
  toggleLandscape: () => Promise<void>;
} {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return;
    return () => {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      ).catch(() => {});
    };
  }, []);

  const toggleLandscape = useCallback(async () => {
    if (Platform.OS === "web") return;
    // Update state before awaiting so re-render happens synchronously within
    // the current React act() batch (important for tests and perceived responsiveness).
    if (isLandscape) {
      setIsLandscape(false);
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      );
    } else {
      setIsLandscape(true);
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE,
      );
    }
  }, [isLandscape]);

  return { isLandscape, toggleLandscape };
}
