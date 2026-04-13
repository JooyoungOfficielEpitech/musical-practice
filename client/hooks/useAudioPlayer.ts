import { useState, useRef, useCallback, useEffect } from "react";
import { createAudioPlayer } from "expo-audio";
import type { AudioPlayer, AudioStatus } from "expo-audio";

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
  const playerRef = useRef<AudioPlayer | null>(null);
  const subscriptionRef = useRef<{ remove(): void } | null>(null);

  const _removePlayer = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    playerRef.current?.remove();
    playerRef.current = null;
  }, []);

  const loadSound = useCallback(async (uri: string) => {
    if (!uri) return;
    try {
      setError(null);
      console.log("[AudioPlayer] loadSound:", uri.slice(0, 80));

      _removePlayer();

      const player = createAudioPlayer({ uri });
      playerRef.current = player;

      subscriptionRef.current = player.addListener(
        "playbackStatusUpdate",
        (status: AudioStatus) => {
          setIsPlaying(status.playing);
          setPositionMs(Math.round(status.currentTime * 1000));
          if (status.duration) setDurationMs(Math.round(status.duration * 1000));
          if (status.isLoaded && !isLoaded) setIsLoaded(true);
        },
      );

      // Poll isLoaded since the event may not fire synchronously
      const poll = setInterval(() => {
        if (player.isLoaded) {
          setIsLoaded(true);
          if (player.duration) setDurationMs(Math.round(player.duration * 1000));
          clearInterval(poll);
        }
      }, 100);
      setTimeout(() => clearInterval(poll), 5000);
    } catch (e) {
      console.error("[AudioPlayer] loadSound FAILED:", e);
      setError(e instanceof Error ? e.message : "Failed to load audio");
      setIsLoaded(false);
    }
  }, [_removePlayer, isLoaded]);

  const play = useCallback(async () => {
    playerRef.current?.play();
  }, []);

  const pause = useCallback(async () => {
    playerRef.current?.pause();
  }, []);

  const seekTo = useCallback(async (ms: number) => {
    await playerRef.current?.seekTo(ms / 1000);
  }, []);

  const unload = useCallback(async () => {
    _removePlayer();
    setIsLoaded(false);
    setIsPlaying(false);
    setPositionMs(0);
    setDurationMs(0);
  }, [_removePlayer]);

  useEffect(() => {
    return () => { _removePlayer(); };
  }, [_removePlayer]);

  return { isLoaded, isPlaying, positionMs, durationMs, error, loadSound, play, pause, seekTo, unload };
}
