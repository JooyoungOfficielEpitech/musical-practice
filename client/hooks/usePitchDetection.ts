import { useState, useRef, useCallback, useEffect } from "react";
import { AppState, Platform } from "react-native";
import { setAudioModeAsync } from "expo-audio";
import { initAudioStream, startAudioStream, stopAudioStream } from "@/lib/audio/audioStream";
import { detectPitch, destroyDetector, initDetector } from "@/lib/audio/pitchDetector";
import { DEFAULT_AUDIO_CONFIG } from "@/lib/audio/types";
import type { PitchResult } from "@/lib/audio/types";

export const THROTTLE_MS = 50; // ~20Hz pitch updates

interface UsePitchDetectionOptions {
  onAudioData?: (data: Float32Array) => void;
}

interface UsePitchDetectionReturn {
  isListening: boolean;
  currentPitch: PitchResult | null;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
}

export function usePitchDetection(
  options?: UsePitchDetectionOptions,
): UsePitchDetectionReturn {
  const [isListening, setIsListening] = useState(false);
  const [currentPitch, setCurrentPitch] = useState<PitchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastUpdateRef = useRef(0);
  const isListeningRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

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
    // Leave record mode — staying in it ducks playback volume/routing on iOS.
    if (Platform.OS !== "web") {
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    }
  }, []);

  const startListening = useCallback(async () => {
    try {
      setError(null);
      console.log("[PitchDetection] startListening — init detector + audio stream");

      // iOS needs the play-and-record session BEFORE the mic stream starts,
      // or recording fails / output reroutes. (expo-audio, NOT expo-av — the
      // expo-av variant conflicts with LiveAudioStream's session handling.)
      if (Platform.OS !== "web") {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          shouldPlayInBackground: false,
        });
      }

      initDetector(DEFAULT_AUDIO_CONFIG.sampleRate);
      initAudioStream(DEFAULT_AUDIO_CONFIG);

      let dataCount = 0;
      const unsubscribe = startAudioStream((audioData) => {
        dataCount++;
        if (dataCount <= 3 || dataCount % 1000 === 0) {
          console.log(
            `[PitchDetection] audio data #${dataCount}, samples: ${audioData.length}, hasOnAudioData: ${!!optionsRef.current?.onAudioData}`,
          );
        }

        // Forward raw audio data for recording (unthrottled)
        optionsRef.current?.onAudioData?.(audioData);

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
      console.log("[PitchDetection] listening started OK");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to start audio stream";
      console.error("[PitchDetection] startListening FAILED:", e);
      setError(msg);
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
