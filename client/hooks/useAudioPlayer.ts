import { useState, useRef, useCallback, useEffect } from "react";
import { Audio, AVPlaybackStatus } from "expo-av";

interface UseAudioPlayerReturn {
  isLoaded: boolean;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  error: string | null;
  loadSound: (uri: string) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  unload: () => Promise<void>;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setIsPlaying(status.isPlaying);
    setPositionMs(status.positionMillis);
    if (status.durationMillis) {
      setDurationMs(status.durationMillis);
    }
  }, []);

  const loadSound = useCallback(
    async (uri: string) => {
      if (!uri) return;

      try {
        setError(null);
        console.log("[AudioPlayer] loadSound:", uri.slice(0, 80));

        // Unload previous sound
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
        }

        const { sound, status } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false },
          onPlaybackStatusUpdate,
        );

        soundRef.current = sound;
        setIsLoaded(true);

        if (status.isLoaded && status.durationMillis) {
          setDurationMs(status.durationMillis);
          console.log("[AudioPlayer] loaded OK, duration:", status.durationMillis, "ms");
        }
      } catch (e) {
        console.error("[AudioPlayer] loadSound FAILED:", e);
        setError(e instanceof Error ? e.message : "Failed to load audio");
        setIsLoaded(false);
      }
    },
    [onPlaybackStatusUpdate],
  );

  const play = useCallback(async () => {
    console.log("[AudioPlayer] play, hasSound:", !!soundRef.current);
    if (soundRef.current) {
      await soundRef.current.playAsync();
    }
  }, []);

  const pause = useCallback(async () => {
    console.log("[AudioPlayer] pause");
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
    }
  }, []);

  const seekTo = useCallback(async (ms: number) => {
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(ms);
    }
  }, []);

  const unload = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setIsLoaded(false);
    setIsPlaying(false);
    setPositionMs(0);
    setDurationMs(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  return {
    isLoaded,
    isPlaying,
    positionMs,
    durationMs,
    error,
    loadSound,
    play,
    pause,
    seekTo,
    unload,
  };
}
