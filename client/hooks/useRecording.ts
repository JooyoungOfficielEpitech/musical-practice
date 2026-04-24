import { useState, useRef, useCallback } from "react";
import { File, Directory, Paths } from "expo-file-system";
import { encodeWav } from "@/lib/audio/wavEncoder";
import { saveRecording } from "@/lib/recordingStorage";
import { generateId } from "@/lib/storage";
import { DEFAULT_AUDIO_CONFIG } from "@/lib/audio/types";
import type { Recording } from "@/lib/audio/types";

interface UseRecordingReturn {
  isRecording: boolean;
  recordingDuration: number;
  startRecording: () => void;
  stopRecording: (sessionId: string) => Promise<string | null>;
  addAudioData: (data: Float32Array) => void;
}

export function useRecording(): UseRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const chunksRef = useRef<Float32Array[]>([]);
  const isRecordingRef = useRef(false);
  const startTimeRef = useRef(0);

  const startRecording = useCallback(() => {
    chunksRef.current = [];
    isRecordingRef.current = true;
    startTimeRef.current = Date.now();
    setIsRecording(true);
    setRecordingDuration(0);
    if (__DEV__) console.log("[useRecording] startRecording called");
  }, []);

  const addAudioData = useCallback((data: Float32Array) => {
    if (!isRecordingRef.current) return;
    chunksRef.current.push(data);
    if (chunksRef.current.length % 500 === 1) {
      if (__DEV__) console.log(`[useRecording] chunks: ${chunksRef.current.length}, latest size: ${data.length}`);
    }
  }, []);

  const stopRecording = useCallback(
    async (sessionId: string): Promise<string | null> => {
      isRecordingRef.current = false;
      setIsRecording(false);

      const chunks = chunksRef.current;
      chunksRef.current = [];

      if (__DEV__) console.log(`[useRecording] stopRecording: ${chunks.length} chunks, sessionId: ${sessionId}`);

      if (chunks.length === 0) {
        if (__DEV__) console.warn("[useRecording] No audio chunks — recording empty");
        return null;
      }

      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      const wavBuffer = encodeWav(chunks, DEFAULT_AUDIO_CONFIG.sampleRate);

      // Write WAV file
      const recordingsDir = new Directory(Paths.document, "recordings");
      if (!recordingsDir.exists) {
        recordingsDir.create();
      }

      const id = generateId();
      const filename = `${id}.wav`;
      const file = new File(recordingsDir, filename);
      const uint8 = new Uint8Array(wavBuffer);
      file.write(uint8);

      const recording: Recording = {
        id,
        sessionId,
        title: `Recording ${new Date().toLocaleString()}`,
        fileUri: file.uri,
        duration,
        createdAt: Date.now(),
        fileSize: wavBuffer.byteLength,
      };

      await saveRecording(recording);

      return file.uri;
    },
    [],
  );

  return {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    addAudioData,
  };
}
