import { File, Directory, Paths } from "expo-file-system";
import { AudioBuffer } from "react-native-audio-api";
import { Asset } from "expo-asset";
 
import {
  loadInstrumentSamples,
  clearSampleCache,
  getInstrumentSampleDir,
  instrumentSamplesExist,
} from "./soundFontLoader";

/**
 * Bundled acoustic piano sample assets.
 * Maps MIDI number to require() asset for the 88-key range (21-108).
 */
 
const PIANO_ASSETS: Record<number, number> = {
  21: require("../../../assets/soundfonts/acoustic-piano/21.mp3"),
  22: require("../../../assets/soundfonts/acoustic-piano/22.mp3"),
  23: require("../../../assets/soundfonts/acoustic-piano/23.mp3"),
  24: require("../../../assets/soundfonts/acoustic-piano/24.mp3"),
  25: require("../../../assets/soundfonts/acoustic-piano/25.mp3"),
  26: require("../../../assets/soundfonts/acoustic-piano/26.mp3"),
  27: require("../../../assets/soundfonts/acoustic-piano/27.mp3"),
  28: require("../../../assets/soundfonts/acoustic-piano/28.mp3"),
  29: require("../../../assets/soundfonts/acoustic-piano/29.mp3"),
  30: require("../../../assets/soundfonts/acoustic-piano/30.mp3"),
  31: require("../../../assets/soundfonts/acoustic-piano/31.mp3"),
  32: require("../../../assets/soundfonts/acoustic-piano/32.mp3"),
  33: require("../../../assets/soundfonts/acoustic-piano/33.mp3"),
  34: require("../../../assets/soundfonts/acoustic-piano/34.mp3"),
  35: require("../../../assets/soundfonts/acoustic-piano/35.mp3"),
  36: require("../../../assets/soundfonts/acoustic-piano/36.mp3"),
  37: require("../../../assets/soundfonts/acoustic-piano/37.mp3"),
  38: require("../../../assets/soundfonts/acoustic-piano/38.mp3"),
  39: require("../../../assets/soundfonts/acoustic-piano/39.mp3"),
  40: require("../../../assets/soundfonts/acoustic-piano/40.mp3"),
  41: require("../../../assets/soundfonts/acoustic-piano/41.mp3"),
  42: require("../../../assets/soundfonts/acoustic-piano/42.mp3"),
  43: require("../../../assets/soundfonts/acoustic-piano/43.mp3"),
  44: require("../../../assets/soundfonts/acoustic-piano/44.mp3"),
  45: require("../../../assets/soundfonts/acoustic-piano/45.mp3"),
  46: require("../../../assets/soundfonts/acoustic-piano/46.mp3"),
  47: require("../../../assets/soundfonts/acoustic-piano/47.mp3"),
  48: require("../../../assets/soundfonts/acoustic-piano/48.mp3"),
  49: require("../../../assets/soundfonts/acoustic-piano/49.mp3"),
  50: require("../../../assets/soundfonts/acoustic-piano/50.mp3"),
  51: require("../../../assets/soundfonts/acoustic-piano/51.mp3"),
  52: require("../../../assets/soundfonts/acoustic-piano/52.mp3"),
  53: require("../../../assets/soundfonts/acoustic-piano/53.mp3"),
  54: require("../../../assets/soundfonts/acoustic-piano/54.mp3"),
  55: require("../../../assets/soundfonts/acoustic-piano/55.mp3"),
  56: require("../../../assets/soundfonts/acoustic-piano/56.mp3"),
  57: require("../../../assets/soundfonts/acoustic-piano/57.mp3"),
  58: require("../../../assets/soundfonts/acoustic-piano/58.mp3"),
  59: require("../../../assets/soundfonts/acoustic-piano/59.mp3"),
  60: require("../../../assets/soundfonts/acoustic-piano/60.mp3"),
  61: require("../../../assets/soundfonts/acoustic-piano/61.mp3"),
  62: require("../../../assets/soundfonts/acoustic-piano/62.mp3"),
  63: require("../../../assets/soundfonts/acoustic-piano/63.mp3"),
  64: require("../../../assets/soundfonts/acoustic-piano/64.mp3"),
  65: require("../../../assets/soundfonts/acoustic-piano/65.mp3"),
  66: require("../../../assets/soundfonts/acoustic-piano/66.mp3"),
  67: require("../../../assets/soundfonts/acoustic-piano/67.mp3"),
  68: require("../../../assets/soundfonts/acoustic-piano/68.mp3"),
  69: require("../../../assets/soundfonts/acoustic-piano/69.mp3"),
  70: require("../../../assets/soundfonts/acoustic-piano/70.mp3"),
  71: require("../../../assets/soundfonts/acoustic-piano/71.mp3"),
  72: require("../../../assets/soundfonts/acoustic-piano/72.mp3"),
  73: require("../../../assets/soundfonts/acoustic-piano/73.mp3"),
  74: require("../../../assets/soundfonts/acoustic-piano/74.mp3"),
  75: require("../../../assets/soundfonts/acoustic-piano/75.mp3"),
  76: require("../../../assets/soundfonts/acoustic-piano/76.mp3"),
  77: require("../../../assets/soundfonts/acoustic-piano/77.mp3"),
  78: require("../../../assets/soundfonts/acoustic-piano/78.mp3"),
  79: require("../../../assets/soundfonts/acoustic-piano/79.mp3"),
  80: require("../../../assets/soundfonts/acoustic-piano/80.mp3"),
  81: require("../../../assets/soundfonts/acoustic-piano/81.mp3"),
  82: require("../../../assets/soundfonts/acoustic-piano/82.mp3"),
  83: require("../../../assets/soundfonts/acoustic-piano/83.mp3"),
  84: require("../../../assets/soundfonts/acoustic-piano/84.mp3"),
  85: require("../../../assets/soundfonts/acoustic-piano/85.mp3"),
  86: require("../../../assets/soundfonts/acoustic-piano/86.mp3"),
  87: require("../../../assets/soundfonts/acoustic-piano/87.mp3"),
  88: require("../../../assets/soundfonts/acoustic-piano/88.mp3"),
  89: require("../../../assets/soundfonts/acoustic-piano/89.mp3"),
  90: require("../../../assets/soundfonts/acoustic-piano/90.mp3"),
  91: require("../../../assets/soundfonts/acoustic-piano/91.mp3"),
  92: require("../../../assets/soundfonts/acoustic-piano/92.mp3"),
  93: require("../../../assets/soundfonts/acoustic-piano/93.mp3"),
  94: require("../../../assets/soundfonts/acoustic-piano/94.mp3"),
  95: require("../../../assets/soundfonts/acoustic-piano/95.mp3"),
  96: require("../../../assets/soundfonts/acoustic-piano/96.mp3"),
  97: require("../../../assets/soundfonts/acoustic-piano/97.mp3"),
  98: require("../../../assets/soundfonts/acoustic-piano/98.mp3"),
  99: require("../../../assets/soundfonts/acoustic-piano/99.mp3"),
  100: require("../../../assets/soundfonts/acoustic-piano/100.mp3"),
  101: require("../../../assets/soundfonts/acoustic-piano/101.mp3"),
  102: require("../../../assets/soundfonts/acoustic-piano/102.mp3"),
  103: require("../../../assets/soundfonts/acoustic-piano/103.mp3"),
  104: require("../../../assets/soundfonts/acoustic-piano/104.mp3"),
  105: require("../../../assets/soundfonts/acoustic-piano/105.mp3"),
  106: require("../../../assets/soundfonts/acoustic-piano/106.mp3"),
  107: require("../../../assets/soundfonts/acoustic-piano/107.mp3"),
  108: require("../../../assets/soundfonts/acoustic-piano/108.mp3"),
};

/** Metadata for an instrument pack. */
export interface InstrumentMeta {
  id: string;
  name: string;
  icon: string; // Ionicons name
  sampleCount: number;
  sizeBytes: number;
  downloadUrl: string | null; // null for built-in instruments
  isBuiltin: boolean;
  isDownloaded: boolean;
}

/** Built-in instruments that don't require downloads. */
const BUILTIN_INSTRUMENTS: Omit<InstrumentMeta, "isDownloaded">[] = [
  {
    id: "oscillator",
    name: "Sine Wave",
    icon: "radio-outline",
    sampleCount: 0,
    sizeBytes: 0,
    downloadUrl: null,
    isBuiltin: true,
  },
  {
    id: "piano",
    name: "Piano (Synth)",
    icon: "musical-notes-outline",
    sampleCount: 0,
    sizeBytes: 0,
    downloadUrl: null,
    isBuiltin: true,
  },
];

/**
 * Downloadable instrument packs.
 * URLs are placeholders — actual hosting TBD.
 * Each pack is a zip of {midiNumber}.mp3 files.
 */
const DOWNLOADABLE_INSTRUMENTS: Omit<InstrumentMeta, "isDownloaded">[] = [
  {
    id: "acoustic-piano",
    name: "Acoustic Piano",
    icon: "musical-notes",
    sampleCount: 88,
    sizeBytes: 1_800_000,
    downloadUrl: "bundled", // Bundled in assets/soundfonts/acoustic-piano/
    isBuiltin: false,
  },
  {
    id: "electric-piano",
    name: "Electric Piano",
    icon: "flash-outline",
    sampleCount: 61,
    sizeBytes: 8_000_000,
    downloadUrl: null,
    isBuiltin: false,
  },
  {
    id: "strings",
    name: "Strings",
    icon: "ear-outline",
    sampleCount: 49,
    sizeBytes: 12_000_000,
    downloadUrl: null,
    isBuiltin: false,
  },
  {
    id: "flute",
    name: "Flute",
    icon: "water-outline",
    sampleCount: 37,
    sizeBytes: 5_000_000,
    downloadUrl: null,
    isBuiltin: false,
  },
];

const ALL_INSTRUMENTS = [...BUILTIN_INSTRUMENTS, ...DOWNLOADABLE_INSTRUMENTS];

/** Get the soundfonts base directory. */
function getSoundfontsDir(): Directory {
  return new Directory(Paths.document, "soundfonts");
}

/** Ensure the soundfonts directory exists. */
function ensureSoundfontsDir(): void {
  const dir = getSoundfontsDir();
  if (!dir.exists) {
    dir.create();
  }
}

/**
 * Get all available instruments with their download status.
 */
export function getAvailableInstruments(): InstrumentMeta[] {
  return ALL_INSTRUMENTS.map((inst) => ({
    ...inst,
    isDownloaded: inst.isBuiltin || instrumentSamplesExist(inst.id),
  }));
}

/**
 * Get a single instrument's metadata.
 */
export function getInstrument(id: string): InstrumentMeta | null {
  const meta = ALL_INSTRUMENTS.find((i) => i.id === id);
  if (!meta) return null;
  return {
    ...meta,
    isDownloaded: meta.isBuiltin || instrumentSamplesExist(meta.id),
  };
}

/**
 * Check if an instrument is available for use (built-in or downloaded).
 */
export function isInstrumentAvailable(id: string): boolean {
  const meta = ALL_INSTRUMENTS.find((i) => i.id === id);
  if (!meta) return false;
  return meta.isBuiltin || instrumentSamplesExist(id);
}

/**
 * Download an instrument pack.
 * Returns a progress callback interface.
 *
 * @param id - Instrument ID to download
 * @param onProgress - Optional callback for download progress (0-1)
 */
export async function downloadInstrument(
  id: string,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const meta = ALL_INSTRUMENTS.find((i) => i.id === id);
  if (!meta) throw new Error(`Unknown instrument: ${id}`);
  if (meta.isBuiltin) throw new Error(`Cannot download built-in instrument: ${id}`);
  if (!meta.downloadUrl) {
    throw new Error(
      `Instrument "${meta.name}" is not yet available for download. Sample hosting is not configured.`,
    );
  }

  ensureSoundfontsDir();

  const targetDir = new Directory(Paths.document, `soundfonts/${id}`);
  if (!targetDir.exists) {
    targetDir.create();
  }

  // Handle bundled assets (acoustic-piano ships with the app)
  if (meta.downloadUrl === "bundled" && id === "acoustic-piano") {
    const entries = Object.entries(PIANO_ASSETS);
    const total = entries.length;
    let completed = 0;

    for (const [midiStr, assetModule] of entries) {
      const asset = Asset.fromModule(assetModule);
      await asset.downloadAsync();

      if (asset.localUri) {
        const source = new File(asset.localUri);
        const dest = new File(targetDir, `${midiStr}.mp3`);
        if (!dest.exists) {
          source.copy(dest);
        }
      }

      completed++;
      onProgress?.(completed / total);
    }
    return;
  }

  // Remote download: fetch zip and extract (for future hosted instruments)
  // TODO: Implement when remote instrument hosting is configured
  throw new Error(
    `Remote instrument download not yet implemented for "${meta.name}".`,
  );
}

/**
 * Delete a downloaded instrument's samples.
 */
export function deleteInstrument(id: string): void {
  const meta = ALL_INSTRUMENTS.find((i) => i.id === id);
  if (!meta) return;
  if (meta.isBuiltin) return;

  const dir = new Directory(Paths.document, `soundfonts/${id}`);
  if (dir.exists) {
    dir.delete();
  }

  // Clear from sample cache
  clearSampleCache(getInstrumentSampleDir(id));
}

/**
 * Load an instrument's samples into AudioBuffers.
 * For built-in instruments, returns null (they don't use AudioBuffers).
 * For downloaded instruments, loads from disk.
 */
export async function loadInstrument(
  id: string,
): Promise<Map<number, AudioBuffer> | null> {
  const meta = ALL_INSTRUMENTS.find((i) => i.id === id);
  if (!meta) throw new Error(`Unknown instrument: ${id}`);

  // Built-in instruments don't use AudioBuffers
  if (meta.isBuiltin) return null;

  if (!instrumentSamplesExist(id)) {
    throw new Error(`Instrument "${meta.name}" is not downloaded`);
  }

  const dirUri = getInstrumentSampleDir(id);
  return loadInstrumentSamples(dirUri);
}

/**
 * Get the disk size of a downloaded instrument in bytes.
 * Returns 0 for built-in or non-downloaded instruments.
 */
export function getInstrumentDiskSize(id: string): number {
  const dir = new Directory(Paths.document, `soundfonts/${id}`);
  if (!dir.exists) return 0;

  let totalSize = 0;
  const entries = dir.list();
  for (const entry of entries) {
    if (entry instanceof File) {
      totalSize += entry.size;
    }
  }
  return totalSize;
}
