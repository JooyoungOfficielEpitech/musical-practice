export interface PitchResult {
  frequency: number;
  note: string;
  octave: number;
  cents: number;
  clarity: number;
}

export interface AudioStreamConfig {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  audioSource: number;
}

export interface NoteInfo {
  name: string;
  octave: number;
  frequency: number;
}

export interface PitchAccuracy {
  sessionAccuracy: number;
  totalReadings: number;
  correctReadings: number;
}

export const DEFAULT_AUDIO_CONFIG: AudioStreamConfig = {
  sampleRate: 44100,
  channels: 1,
  bitsPerSample: 16,
  audioSource: 6, // VOICE_RECOGNITION on Android
};

export const CLARITY_THRESHOLD = 0.85;
export const CENTS_THRESHOLD = 50; // ±50 cents = correct
