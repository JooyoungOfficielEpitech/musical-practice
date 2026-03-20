import { useState, useCallback, useEffect } from "react";
import { Platform, Alert, Linking } from "react-native";
import { Audio } from "expo-av";

type PermissionStatus = "undetermined" | "granted" | "denied";

// NOTE: Do NOT call Audio.setAudioModeAsync here.
// react-native-live-audio-stream configures AVAudioSession internally
// in its start() method (PlayAndRecord + VoiceChat mode).
// Calling expo-av's setAudioModeAsync conflicts with LiveAudioStream's
// audio converter, causing 0-channel / 0-bit input format errors.

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

      if (!granted) {
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
