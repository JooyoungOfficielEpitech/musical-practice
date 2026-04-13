import { File, Directory, Paths } from "expo-file-system";
import { AudioContext, AudioBuffer } from "react-native-audio-api";
import { getAudioContext } from "./synthEngine";

/** In-memory cache of loaded instrument samples: instrumentDir -> (midiNumber -> AudioBuffer) */
const sampleCache = new Map<string, Map<number, AudioBuffer>>();

/**
 * Load instrument samples from a directory.
 * Expects files named `{midiNumber}.mp3` (e.g., `60.mp3` for middle C).
 * Returns a Map of MIDI note number to AudioBuffer.
 *
 * @param instrumentDir - Absolute file URI to the directory containing sample files
 */
export async function loadInstrumentSamples(
  instrumentDir: string,
): Promise<Map<number, AudioBuffer>> {
  // Return cached samples if available
  const cached = sampleCache.get(instrumentDir);
  if (cached) return cached;

  const ctx = getAudioContext();
  const samples = new Map<number, AudioBuffer>();
  const dir = new Directory(instrumentDir);

  if (!dir.exists) {
    throw new Error(`Instrument directory does not exist: ${instrumentDir}`);
  }

  // List files in the directory and filter for audio samples
  const entries = dir.list();
  const sampleEntries = entries.filter((entry): entry is File => {
    if (entry instanceof Directory) return false;
    return /^\d+\.(mp3|wav|m4a|ogg)$/.test(entry.name);
  });

  // Load each sample file
  const loadPromises = sampleEntries.map(async (file) => {
    const midiNumber = parseInt(file.name.split(".")[0], 10);
    if (isNaN(midiNumber) || midiNumber < 0 || midiNumber > 127) return;

    try {
      const buffer = await ctx.decodeAudioData(file.uri);
      samples.set(midiNumber, buffer);
    } catch (err) {
      console.warn(`Failed to load sample ${file.name}:`, err);
    }
  });

  await Promise.all(loadPromises);

  // Cache the loaded samples
  sampleCache.set(instrumentDir, samples);
  return samples;
}

/**
 * Load a single sample from a file URI.
 * Useful for loading bundled asset samples.
 */
export async function loadSampleFromUri(
  fileUri: string,
): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  return ctx.decodeAudioData(fileUri);
}

/**
 * Clear cached samples for a specific instrument directory, or all if no dir given.
 */
export function clearSampleCache(instrumentDir?: string): void {
  if (instrumentDir) {
    sampleCache.delete(instrumentDir);
  } else {
    sampleCache.clear();
  }
}

/**
 * Get the sample directory path for a given instrument ID.
 * Instruments are stored under Documents/soundfonts/{instrumentId}/
 */
export function getInstrumentSampleDir(instrumentId: string): string {
  const dir = new Directory(Paths.document, `soundfonts/${instrumentId}`);
  return dir.uri;
}

/**
 * Check if samples exist for a given instrument.
 */
export function instrumentSamplesExist(instrumentId: string): boolean {
  const dirUri = getInstrumentSampleDir(instrumentId);
  const dir = new Directory(dirUri);
  if (!dir.exists) return false;
  const entries = dir.list();
  return entries.some((entry) => {
    if (entry instanceof Directory) return false;
    return /^\d+\.(mp3|wav|m4a|ogg)$/.test(entry.name);
  });
}
