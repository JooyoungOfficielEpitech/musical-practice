import { useState, useRef, useCallback, useEffect } from "react";
import { AppState, Platform } from "react-native";
import { Audio } from "expo-av";
import { initAudioStream, startAudioStream, stopAudioStream } from "@/lib/audio/audioStream";
import { detectPitch, destroyDetector, initDetector } from "@/lib/audio/pitchDetector";
import { DEFAULT_AUDIO_CONFIG } from "@/lib/audio/types";
import type { PitchResult } from "@/lib/audio/types";

const THROTTLE_MS = 100; // 10fps — reduces CPU load vs 15fps

interface UsePitchDetectionReturn {
  isListening: boolean;
  currentPitch: PitchResult | null;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
}

export function usePitchDetection(): UsePitchDetectionReturn {
  const [isListening, setIsListening] = useState(false);
  const [currentPitch, setCurrentPitch] = useState<PitchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastUpdateRef = useRef(0);
  const isListeningRef = useRef(false);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    setCurrentPitch(null);

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    stopAudioStream();
    destroyDetector();
  }, []);

  const startListening = useCallback(async () => {
    try {
      setError(null);

      // Ensure audio session is configured for recording on iOS
      if (Platform.OS === "ios") {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: 1,
          shouldDuckAndroid: false,
          interruptionModeAndroid: 1,
          playThroughEarpieceAndroid: false,
        });
      }

      initDetector(DEFAULT_AUDIO_CONFIG.sampleRate);
      initAudioStream(DEFAULT_AUDIO_CONFIG);

      const unsubscribe = startAudioStream((audioData) => {
        const now = Date.now();
        if (now - lastUpdateRef.current < THROTTLE_MS) return;
        lastUpdateRef.current = now;

        const result = detectPitch(audioData, DEFAULT_AUDIO_CONFIG.sampleRate);
        if (result) {
          setCurrentPitch(result);
        }
      });

      unsubscribeRef.current = unsubscribe;
      isListeningRef.current = true;
      setIsListening(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start audio stream");
      stopListening();
    }
  }, [stopListening]);

  // Stop on background
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && isListeningRef.current) {
        stopListening();
      }
    });

    return () => {
      subscription.remove();
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    currentPitch,
    error,
    startListening,
    stopListening,
  };
}
