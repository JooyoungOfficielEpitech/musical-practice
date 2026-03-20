/**
 * Maps musical notes to Y positions on a treble clef staff (SVG coordinates).
 *
 * Treble clef staff lines (bottom to top):
 *   Line 1: E4
 *   Line 2: G4
 *   Line 3: B4
 *   Line 4: D5
 *   Line 5: F5
 *
 * Convention: y=0 is the top line (F5), y increases downward.
 */

export interface StaffPosition {
  /** Y coordinate in SVG space (0 = top of staff area) */
  y: number;
  /** Number of ledger lines needed (positive = below or above staff) */
  needsLedgerLines: number;
  /** Whether the note sits on a line (vs in a space) */
  isOnLine: boolean;
  /** Accidental symbol if present */
  accidental?: "sharp" | "flat";
  /** Octave transposition applied for display: "8va" (sounds higher), "8vb" (sounds lower), or null */
  transposition: "8va" | "8vb" | null;
  /** Number of octaves shifted for display */
  octavesShifted: number;
  /** Whether the note is outside the configured range */
  outOfRange?: boolean;
}

export interface StaffConfig {
  lowOctave: number;
  highOctave: number;
}

// Diatonic note positions relative to C in the same octave
// Each step = one staff position (line or space)
const DIATONIC_INDEX: Record<string, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

// E4 is the bottom line (line 1). Its diatonic position = E4 = octave 4, note E = index 2
// Global diatonic position = octave * 7 + noteIndex
// E4 = 4*7 + 2 = 30
// F5 = 5*7 + 3 = 38
const BOTTOM_LINE_POS = 30; // E4
const TOP_LINE_POS = 38; // F5
const STAFF_LINES = 5;
const LINE_POSITIONS = [30, 32, 34, 36, 38]; // E4, G4, B4, D5, F5

/**
 * Convert a note name + octave to a Y position on a treble clef staff.
 */
export function noteToStaffY(
  note: string,
  octave: number,
  staffHeight: number,
): StaffPosition {
  // Parse accidentals
  let baseName = note;
  let accidental: "sharp" | "flat" | undefined;

  if (note.includes("#")) {
    baseName = note.replace("#", "");
    accidental = "sharp";
  } else if (note.includes("b") && note.length > 1) {
    baseName = note.replace("b", "");
    accidental = "flat";
  }

  const noteIndex = DIATONIC_INDEX[baseName];
  if (noteIndex === undefined) {
    return { y: staffHeight / 2, needsLedgerLines: 0, isOnLine: false, transposition: null, octavesShifted: 0 };
  }

  // Global diatonic position
  const position = octave * 7 + noteIndex;

  // Staff spacing: distance between adjacent lines = staffHeight / (STAFF_LINES - 1)
  // Half-step = distance between line and space = lineSpacing / 2
  const lineSpacing = staffHeight / (STAFF_LINES - 1);
  const halfStep = lineSpacing / 2;

  // Y calculation: top line (F5, position 38) is at y=0
  // Each diatonic step down increases y by halfStep
  const stepsFromTop = TOP_LINE_POS - position;
  const y = stepsFromTop * halfStep;

  // Is this position on a line? (staff lines or ledger lines)
  // Staff lines are at even positions (30, 32, 34, 36, 38)
  // Ledger lines extend the pattern: 28 (C4), 26 (A3), 40 (G5), 42 (B5), etc.
  const isOnLine = position % 2 === 0;

  // Calculate ledger lines needed
  let needsLedgerLines = 0;
  if (position < BOTTOM_LINE_POS) {
    // Below staff: count how many ledger line positions are needed
    // Ledger lines at positions 28 (C4), 26 (A3), 24 (F3), ...
    // A note needs a ledger line if it's on or below a ledger line position
    const stepsBelow = BOTTOM_LINE_POS - position;
    needsLedgerLines = Math.ceil(stepsBelow / 2);
  } else if (position > TOP_LINE_POS) {
    // Above staff
    const stepsAbove = position - TOP_LINE_POS;
    needsLedgerLines = Math.ceil(stepsAbove / 2);
  }

  return { y, needsLedgerLines, isOnLine, accidental, transposition: null, octavesShifted: 0 };
}

const MAX_LEDGER_LINES = 2;
const MAX_TRANSPOSITIONS = 4;

/**
 * Like noteToStaffY, but clamps extreme notes via 8va/8vb octave transposition
 * so that no more than MAX_LEDGER_LINES ledger lines are needed.
 */
export function noteToStaffYClamped(
  note: string,
  octave: number,
  staffHeight: number,
): StaffPosition {
  let result = noteToStaffY(note, octave, staffHeight);

  if (result.needsLedgerLines <= MAX_LEDGER_LINES) {
    return result;
  }

  let currentOctave = octave;
  let octavesShifted = 0;
  let transposition: "8va" | "8vb" | null = null;

  // Too high above staff (y < 0 means above top line)
  while (result.needsLedgerLines > MAX_LEDGER_LINES && result.y < 0 && octavesShifted < MAX_TRANSPOSITIONS) {
    currentOctave -= 1;
    octavesShifted += 1;
    transposition = "8va";
    result = noteToStaffY(note, currentOctave, staffHeight);
  }

  // Too low below staff (y > staffHeight means below bottom line)
  while (result.needsLedgerLines > MAX_LEDGER_LINES && result.y > staffHeight && octavesShifted < MAX_TRANSPOSITIONS) {
    currentOctave += 1;
    octavesShifted += 1;
    transposition = "8vb";
    result = noteToStaffY(note, currentOctave, staffHeight);
  }

  return { ...result, transposition, octavesShifted };
}

// --- Dynamic range-based staff mapping ---

const MIN_STAFF_LINES = 5;

/**
 * Calculate the number of staff lines needed for a given octave range.
 * Each octave spans 7 diatonic positions (C-B). We place a line every 2 positions.
 * Minimum is 5 lines (standard staff).
 */
export function getStaffLineCount(config: StaffConfig): number {
  const totalDiatonicPositions = (config.highOctave - config.lowOctave + 1) * 7;
  // One line per 2 diatonic positions, plus 1
  const lines = Math.ceil(totalDiatonicPositions / 2) + 1;
  return Math.max(lines, MIN_STAFF_LINES);
}

/**
 * Map a note to a Y position on a dynamically-ranged staff.
 * Range is C{lowOctave} to B{highOctave}.
 * Notes outside range are clamped and flagged with outOfRange.
 */
export function noteToStaffYDynamic(
  note: string,
  octave: number,
  staffHeight: number,
  config: StaffConfig,
): StaffPosition {
  // Parse accidentals
  let baseName = note;
  let accidental: "sharp" | "flat" | undefined;

  if (note.includes("#")) {
    baseName = note.replace("#", "");
    accidental = "sharp";
  } else if (note.includes("b") && note.length > 1) {
    baseName = note.replace("b", "");
    accidental = "flat";
  }

  const noteIndex = DIATONIC_INDEX[baseName];
  if (noteIndex === undefined) {
    return {
      y: staffHeight / 2,
      needsLedgerLines: 0,
      isOnLine: false,
      transposition: null,
      octavesShifted: 0,
    };
  }

  // Global diatonic position of the note
  const position = octave * 7 + noteIndex;

  // Range boundaries
  const bottomPos = config.lowOctave * 7; // C of low octave
  const topPos = (config.highOctave + 1) * 7 - 1; // B of high octave
  const totalPositions = topPos - bottomPos;

  // Y calculation: topPos maps to y=0, bottomPos maps to y=staffHeight
  const stepsFromTop = topPos - position;
  const y = totalPositions > 0 ? (stepsFromTop / totalPositions) * staffHeight : staffHeight / 2;

  // Check if out of range
  const outOfRange = position < bottomPos || position > topPos;

  // Is this position on a line (even diatonic positions relative to range)
  const isOnLine = position % 2 === 0;

  return {
    y,
    needsLedgerLines: 0,
    isOnLine,
    accidental,
    transposition: null,
    octavesShifted: 0,
    outOfRange: outOfRange || undefined,
  };
}
