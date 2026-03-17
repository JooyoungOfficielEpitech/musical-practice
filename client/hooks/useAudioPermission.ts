import { useState, useCallback, useEffect } from "react";
import { Platform, Alert, Linking } from "react-native";
import { Audio } from "expo-av";

type PermissionStatus = "undetermined" | "granted" | "denied";

/**
 * Configure iOS audio session for recording.
 * This prevents the LoudnessManager plist warning by explicitly
 * setting the audio mode before any recording begins.
 */
async function configureAudioSession(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      // Measurement mode gives raw mic input without system processing
      interruptionModeIOS: 1, // DoNotMix
      shouldDuckAndroid: false,
      interruptionModeAndroid: 1, // DoNotMix
      playThroughEarpieceAndroid: false,
    });
  } catch {
    // Non-fatal: audio may still work without explicit session config
  }
}

export function useAudioPermission() {
  const [status, setStatus] = useState<PermissionStatus>("undetermined");

  const checkPermission = useCallback(async () => {
    if (Platform.OS === "web") {
      setStatus("denied");
      return;
    }

    try {
      const { status: currentStatus } = await Audio.getPermissionsAsync();
      setStatus(currentStatus === "granted" ? "granted" : "undetermined");
    } catch {
      setStatus("undetermined");
    }
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") return false;

    try {
      const { status: newStatus } = await Audio.requestPermissionsAsync();
      const granted = newStatus === "granted";
      setStatus(granted ? "granted" : "denied");

      if (granted) {
        // Configure audio session once permission is granted
        await configureAudioSession();
      } else {
        Alert.alert(
          "Microphone Permission Required",
          "Please enable microphone access in Settings to use pitch detection.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ],
        );
      }

      return granted;
    } catch {
      setStatus("denied");
      return false;
    }
  }, []);

  return {
    status,
    isGranted: status === "granted",
    isDenied: status === "denied",
    requestPermission,
  };
}
