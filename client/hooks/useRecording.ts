import { useState, useRef, useCallback } from "react";
import { File, Directory, Paths } from "expo-file-system";
import { encodeWav } from "@/lib/audio/wavEncoder";
import { saveRecording } from "@/lib/recordingStorage";
import { generateId } from "@/lib/storage";
import { DEFAULT_AUDIO_CONFIG } from "@/lib/audio/types";

export interface FinishedTake {
  uri: string;
  durationSec: number;
}

export interface UseRecordingReturn {
  isRecording: boolean;
  startRecording: () => void;
  /** Feed raw mic chunks (the pitch stream's onAudioData). */
  addAudioData: (data: Float32Array) => void;
  /** Encode + persist the take for the sheet. Null when nothing was captured. */
  stopRecording: (sheetId: string) => Promise<FinishedTake | null>;
  discard: () => void;
}

/**
 * Sing-along take recorder: accumulates the mic chunks the pitch detector is
 * already streaming and encodes them to a WAV on stop. Pure JS — OTA-safe.
 */
export function useRecording(): UseRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const chunksRef = useRef<Float32Array[]>([]);
  const isRecordingRef = useRef(false);
  const startTimeRef = useRef(0);

  const startRecording = useCallback(() => {
    chunksRef.current = [];
    isRecordingRef.current = true;
    startTimeRef.current = Date.now();
    setIsRecording(true);
  }, []);

  const addAudioData = useCallback((data: Float32Array) => {
    if (!isRecordingRef.current) return;
    chunksRef.current.push(data);
  }, []);

  const discard = useCallback(() => {
    isRecordingRef.current = false;
    chunksRef.current = [];
    setIsRecording(false);
  }, []);

  const stopRecording = useCallback(async (sheetId: string): Promise<FinishedTake | null> => {
    isRecordingRef.current = false;
    setIsRecording(false);
    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (chunks.length === 0) return null;

    const durationSec = Math.round((Date.now() - startTimeRef.current) / 1000);
    const wavBuffer = encodeWav(chunks, DEFAULT_AUDIO_CONFIG.sampleRate);

    const recordingsDir = new Directory(Paths.document, "recordings");
    if (!recordingsDir.exists) {
      recordingsDir.create();
    }
    const id = generateId();
    const file = new File(recordingsDir, `${id}.wav`);
    file.write(new Uint8Array(wavBuffer));

    await saveRecording({
      id,
      sheetId,
      title: `Take ${new Date().toLocaleString()}`,
      fileUri: file.uri,
      duration: durationSec,
      createdAt: Date.now(),
      fileSize: wavBuffer.byteLength,
    });

    return { uri: file.uri, durationSec };
  }, []);

  return { isRecording, startRecording, addAudioData, stopRecording, discard };
}
