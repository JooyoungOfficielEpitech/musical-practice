/**
 * noteEditLocator — maps a tapped note (part + midi + occurrence) to the index
 * of its <note> block in XML document order, for safe pitch editing.
 *
 * Matching is done on the note's EFFECTIVE midi number, mirroring the audio
 * parser exactly: explicit <alter> wins, otherwise the key signature applies.
 * This makes the locator immune to key signatures and enharmonic spelling
 * (the parser labels Bb as "A#"), which step/alter string matching is not.
 */
import type { NoteEvent } from "../../types/music";

interface NoteIdentity {
  partIndex: number;
  midiNumber: number;
  occurrence: number;
}

const NOTE_BLOCK_RE = /<note\b[^>]*>[\s\S]*?<\/note>/g;
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];
const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function keyAccidentals(fifths: number): Record<string, number> {
  const acc: Record<string, number> = {};
  if (fifths > 0) for (let i = 0; i < Math.min(fifths, 7); i++) acc[SHARP_ORDER[i]] = 1;
  else if (fifths < 0) for (let i = 0; i < Math.min(-fifths, 7); i++) acc[FLAT_ORDER[i]] = -1;
  return acc;
}

function effectiveMidi(noteXml: string, keyAcc: Record<string, number>): number | null {
  const step = noteXml.match(/<step>([A-G])<\/step>/)?.[1];
  const octaveStr = noteXml.match(/<octave>(-?\d+)<\/octave>/)?.[1];
  if (!step || octaveStr === undefined) return null;
  const alterStr = noteXml.match(/<alter>(-?\d+)<\/alter>/)?.[1];
  const alter = alterStr !== undefined ? parseInt(alterStr, 10) : keyAcc[step] ?? 0;
  return (parseInt(octaveStr, 10) + 1) * 12 + STEP_SEMITONES[step] + alter;
}

/**
 * Locate the target note's <note>-block index in XML document order.
 * Occurrence = nth note in the part with that effective midi number.
 * Returns null (never a wrong index) when the note can't be located safely —
 * including any score containing repeats, where the played sequence visits the
 * same written note twice and occurrence counting would be ambiguous.
 */
export function findXmlNoteIndex(xmlString: string, identity: NoteIdentity): number | null {
  const { partIndex, midiNumber, occurrence } = identity;
  if (xmlString.includes("<repeat")) return null;

  const parts = [...xmlString.matchAll(/<part\b[^>]*>[\s\S]*?<\/part>/g)].map((m) => m[0]);
  if (partIndex < 0 || partIndex >= parts.length) return null;

  const fifthsStr = xmlString.match(/<fifths>(-?\d+)<\/fifths>/)?.[1];
  const keyAcc = keyAccidentals(fifthsStr !== undefined ? parseInt(fifthsStr, 10) : 0);

  // Global index counts ALL <note> blocks (rests included) across earlier parts.
  let globalIndex = 0;
  for (let i = 0; i < partIndex; i++) {
    globalIndex += (parts[i].match(NOTE_BLOCK_RE) ?? []).length;
  }

  // Multi-voice parts interleave voices in XML while playback sorts by time,
  // so occurrence counting is only reliable for single-voice parts.
  const voices = new Set(
    [...parts[partIndex].matchAll(/<voice>([^<]+)<\/voice>/g)].map((m) => m[1].trim()),
  );
  if (voices.size > 1) return null;

  let matchCount = 0;
  for (const block of parts[partIndex].match(NOTE_BLOCK_RE) ?? []) {
    // Tie continuations extend the previous played note — the parser merges
    // them into one NoteEvent, so they must not advance occurrence counting.
    const isTieContinuation = block.includes('<tie type="stop"');
    if (!block.includes("<rest") && !isTieContinuation) {
      const midi = effectiveMidi(block, keyAcc);
      if (midi === midiNumber) {
        if (matchCount === occurrence) {
          // Editing half a tie corrupts the tie chain — refuse tied notes.
          if (block.includes("<tie ")) return null;
          return globalIndex;
        }
        matchCount++;
      }
    }
    globalIndex++;
  }
  return null;
}

/**
 * Occurrence of a tapped note among its part's same-midi notes, in the same
 * time order the parser emitted them — the counterpart of findXmlNoteIndex.
 */
export function computeNoteOccurrence(
  notes: NoteEvent[],
  notePartIndices: number[],
  noteIndex: number,
): number {
  const target = notes[noteIndex];
  const targetPart = notePartIndices[noteIndex];
  let occurrence = 0;
  for (let i = 0; i < noteIndex; i++) {
    if (notePartIndices[i] === targetPart && notes[i].midiNumber === target.midiNumber) {
      occurrence++;
    }
  }
  return occurrence;
}
