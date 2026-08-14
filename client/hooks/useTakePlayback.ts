import { useState, useRef, useCallback, useEffect } from "react";
import { Audio } from "expo-av";

export interface UseTakePlaybackReturn {
  isPlaying: boolean;
  toggle: (uri: string) => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Minimal WAV take player (expo-av). One sound at a time; unloads on stop and
 * on unmount. Playback happens after the mic session ended, so it never races
 * LiveAudioStream's audio-session handling.
 */
export function useTakePlayback(): UseTakePlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const uriRef = useRef<string | null>(null);

  const stop = useCallback(async () => {
    setIsPlaying(false);
    const sound = soundRef.current;
    soundRef.current = null;
    uriRef.current = null;
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch {
        // Already unloaded.
      }
    }
  }, []);

  const toggle = useCallback(
    async (uri: string) => {
      if (soundRef.current && uriRef.current === uri) {
        await stop();
        return;
      }
      await stop();
      try {
        const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
        soundRef.current = sound;
        uriRef.current = uri;
        setIsPlaying(true);
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            void stop();
          }
        });
      } catch {
        setIsPlaying(false);
      }
    },
    [stop],
  );

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  return { isPlaying, toggle, stop };
}
