import type { NoteEvent, NoteSequence, PartInfo, ParsedMusicXml } from "../../types/music";
import { noteToFrequency } from "./noteMapping";

const DEFAULT_TEMPO = 120; // BPM
const DEFAULT_DIVISIONS = 1;
const DEFAULT_VELOCITY = 80;

const ALTER_MAP: Record<number, string> = {
  [-1]: "b",
  [0]: "",
  [1]: "#",
};

/** Maps dynamic marking names to MIDI velocity values */
const DYNAMICS_VELOCITY: Record<string, number> = {
  pp: 20,
  p: 40,
  mp: 55,
  mf: 70,
  f: 90,
  ff: 110,
  fff: 127,
};

/**
 * Key signature: number of fifths to the sharps/flats they imply.
 * Positive fifths = sharps in order: F C G D A E B
 * Negative fifths = flats in order: B E A D G C F
 */
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

function getKeyAccidentals(fifths: number): Record<string, number> {
  const accidentals: Record<string, number> = {};
  if (fifths > 0) {
    for (let i = 0; i < Math.min(fifths, 7); i++) {
      accidentals[SHARP_ORDER[i]] = 1;
    }
  } else if (fifths < 0) {
    for (let i = 0; i < Math.min(-fifths, 7); i++) {
      accidentals[FLAT_ORDER[i]] = -1;
    }
  }
  return accidentals;
}

function getTagContent(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "s");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function getAllMatches(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1]);
  }
  return results;
}

function getAllElements(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^/>]*(?:/>|>[\\s\\S]*?</${tag}>)`, "g");
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[0]);
  }
  return results;
}

function parseTempo(xml: string): number {
  // Look for <sound tempo="120"/> or <per-minute>120</per-minute>
  const soundMatch = xml.match(/<sound[^>]*tempo="(\d+(?:\.\d+)?)"[^>]*\/?>/);
  if (soundMatch) return parseFloat(soundMatch[1]);

  const perMinute = getTagContent(xml, "per-minute");
  if (perMinute) return parseFloat(perMinute);

  return DEFAULT_TEMPO;
}

const DEFAULT_BAR_BEATS = 4; // quarter-note beats per bar (4/4)

/**
 * Bar length in quarter-note beats from a measure's <time> signature.
 * 4/4 -> 4, 3/4 -> 3, 6/8 -> 3, 2/2 -> 4. Returns null if no <time> present.
 */
function parseBarBeats(measureXml: string): number | null {
  const m = measureXml.match(
    /<beats>(\d+)<\/beats>\s*<beat-type>(\d+)<\/beat-type>/,
  );
  if (!m) return null;
  const beats = parseInt(m[1], 10);
  const beatType = parseInt(m[2], 10);
  if (!beats || !beatType) return null;
  return (beats * 4) / beatType;
}

/**
 * Max beats any single voice fills in a measure (quarter-note beats), using the
 * given divisions. Chord notes don't advance time. This is how much musical
 * content the measure actually holds — used to detect over/underfull bars.
 */
function measureContentBeats(measureXml: string, divisions: number): number {
  const voiceSums = new Map<string, number>();
  const noteRegex = /<note\b[^>]*(?:\/>|>[\s\S]*?<\/note>)/g;
  let match: RegExpExecArray | null;
  while ((match = noteRegex.exec(measureXml)) !== null) {
    const noteXml = match[0];
    if (noteXml.includes("<chord")) continue; // chord shares the previous onset
    const voice = getTagContent(noteXml, "voice") ?? "1";
    const durStr = getTagContent(noteXml, "duration");
    const dur = durStr ? parseInt(durStr, 10) : 0;
    const beats = divisions > 0 ? dur / divisions : dur;
    voiceSums.set(voice, (voiceSums.get(voice) ?? 0) + beats);
  }
  let max = 0;
  for (const v of voiceSums.values()) max = Math.max(max, v);
  return max;
}

/**
 * Parse dynamics from a <direction> element.
 * Returns the velocity if a recognized dynamic is found, null otherwise.
 */
function parseDynamicsFromDirection(directionXml: string): number | null {
  for (const [name, velocity] of Object.entries(DYNAMICS_VELOCITY)) {
    // Match <fff/>, <ff/>, <f/>, <mf/>, <mp/>, <p/>, <pp/>
    // Check longest names first won't matter since we iterate all
    const regex = new RegExp(`<${name}\\s*/>`);
    if (regex.test(directionXml)) {
      return velocity;
    }
  }
  return null;
}

function pitchToNoteName(step: string, alter: number): string {
  if (alter === 0) return step;
  if (alter === 1) {
    // Sharp: map to # notation
    return step + "#";
  }
  if (alter === -1) {
    // Flat: convert to equivalent sharp/natural for noteToFrequency compatibility
    const flatToSharp: Record<string, string> = {
      Db: "C#",
      Eb: "D#",
      Fb: "E",
      Gb: "F#",
      Ab: "G#",
      Bb: "A#",
      Cb: "B",
    };
    const flatName = step + "b";
    return flatToSharp[flatName] ?? step;
  }
  // Double sharps/flats: approximate
  if (alter > 0) return step + "#";
  return step;
}

function noteNameToMidi(noteName: string, octave: number): number {
  const NOTE_INDICES: Record<string, number> = {
    C: 0,
    "C#": 1,
    D: 2,
    "D#": 3,
    E: 4,
    F: 5,
    "F#": 6,
    G: 7,
    "G#": 8,
    A: 9,
    "A#": 10,
    B: 11,
  };
  const index = NOTE_INDICES[noteName];
  if (index === undefined) return 60; // fallback to middle C
  return (octave + 1) * 12 + index;
}

/**
 * Find repeat structure in measures. Returns the ordered list of measure indices
 * to process, expanding basic forward/backward repeats.
 */
function expandRepeats(measures: string[]): number[] {
  const result: number[] = [];
  let repeatStart = 0;

  for (let i = 0; i < measures.length; i++) {
    const measure = measures[i];
    result.push(i);

    // Check for forward repeat — marks the start of a repeated section
    if (measure.includes('<repeat direction="forward"')) {
      repeatStart = i;
    }

    // Check for backward repeat — go back to the forward repeat
    if (measure.includes('<repeat direction="backward"')) {
      // Add all measures from repeatStart to i again
      for (let j = repeatStart; j <= i; j++) {
        result.push(j);
      }
    }
  }

  return result;
}

/**
 * Parse ordered elements (notes and directions) from a measure, preserving
 * their document order so dynamics apply correctly.
 */
interface MeasureElement {
  type: "note" | "direction";
  xml: string;
}

function getMeasureElements(measureXml: string): MeasureElement[] {
  const regex = /<(note|direction)\b[^>]*(?:\/>|>[\s\S]*?<\/\1>)/g;
  const elements: MeasureElement[] = [];
  let match;
  while ((match = regex.exec(measureXml)) !== null) {
    elements.push({
      type: match[1] as "note" | "direction",
      xml: match[0],
    });
  }
  return elements;
}

function parsePartList(xmlString: string, allPartXmls: string[]): PartInfo[] {
  const partListMatch = xmlString.match(/<part-list>([\s\S]*?)<\/part-list>/);
  const partListXml = partListMatch ? partListMatch[1] : "";
  const parts: PartInfo[] = [];
  const scorePartRegex = /<score-part\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/score-part>/g;
  let m: RegExpExecArray | null;
  while ((m = scorePartRegex.exec(partListXml)) !== null) {
    const id = m[1];
    const nameMatch = m[2].match(/<part-name[^>]*>([^<]*)<\/part-name>/);
    const name = nameMatch ? nameMatch[1].trim() : id;
    parts.push({ id, name, partIndex: parts.length });
  }
  if (parts.length === 0) {
    allPartXmls.forEach((_, i) =>
      parts.push({ id: `P${i + 1}`, name: `Part ${i + 1}`, partIndex: i })
    );
  }
  return parts;
}

/**
 * Parse a MusicXML string into notes with part metadata.
 * Handles polyphonic music with chords, multiple voices, dynamics,
 * key signatures, and basic repeats.
 */
export function parseMusicXml(xmlString: string): ParsedMusicXml {
  // The first <divisions> seen is only the INITIAL value. Each measure may
  // declare its own <divisions> (every per-system homr run emits one), so it is
  // tracked per-measure below. All position/duration math is done in quarter-note
  // beats — divisions-independent — so mid-stream divisions changes stay
  // temporally consistent across measures and parts.
  const divisionsStr = getTagContent(xmlString, "divisions");
  const firstDivisions = divisionsStr ? parseInt(divisionsStr, 10) : DEFAULT_DIVISIONS;

  const tempo = parseTempo(xmlString);
  const secondsPerBeat = 60 / tempo;

  // Parse key signature
  const fifthsStr = getTagContent(xmlString, "fifths");
  const fifths = fifthsStr ? parseInt(fifthsStr, 10) : 0;
  const keyAccidentals = getKeyAccidentals(fifths);

  // Collect ALL <part> elements — parse each independently, then merge
  const partMatches = [...xmlString.matchAll(/<part\b[^>]*>([\s\S]*?)<\/part>/g)];
  const allPartXmls = partMatches.length > 0 ? partMatches.map((m) => m[1]) : [xmlString];

  const parts = parsePartList(xmlString, allPartXmls);
  const notePartIndices: number[] = [];

  // ── Shared bar grid ────────────────────────────────────────────────────────
  // Every measure index starts at a fixed cumulative beat shared by ALL parts,
  // so a single mis-counted measure in one part (common in OMR output) can never
  // permanently shift that part relative to the others. Notes lay out by their
  // offset within the bar; a measure that overflows its bar is compressed to fit
  // (never leaks past the barline) and a short bar just leaves trailing silence.
  // This makes cross-part drift — the "Hermes vs ensemble" bug — impossible by
  // construction, regardless of OMR quality.
  const partMeasures: string[][] = allPartXmls.map((p) => getAllMatches(p, "measure"));
  const maxMeasures = partMeasures.reduce((mx, ms) => Math.max(mx, ms.length), 0);
  const barBeatsByMeasure: number[] = [];
  let stickyBarBeats = DEFAULT_BAR_BEATS;
  for (let mi = 0; mi < maxMeasures; mi++) {
    let found: number | null = null;
    for (const ms of partMeasures) {
      if (mi < ms.length) {
        const b = parseBarBeats(ms[mi]);
        if (b !== null) { found = b; break; }
      }
    }
    if (found !== null) stickyBarBeats = found;
    barBeatsByMeasure[mi] = stickyBarBeats;
  }

  interface VoiceState {
    intraBeat: number; // beats elapsed since the start of the current measure
    tiedPitch: string | null;
    tiedStartBeat: number; // absolute, grid-anchored start beat of a held tie
    tiedDurationBeats: number; // accumulated (bar-scaled) duration of a held tie
    tiedMidi: number;
    tiedFrequency: number;
    tiedVelocity: number;
  }

  const sequence: NoteSequence = [];

  for (let partIdx = 0; partIdx < allPartXmls.length; partIdx++) {
    const measures = partMeasures[partIdx];
    const pushNote = (note: NoteEvent): void => {
      sequence.push(note);
      notePartIndices.push(partIdx);
    };
    const measureOrder = expandRepeats(measures);

    // Fresh voice state per part
    const voiceStates = new Map<string, VoiceState>();
    let currentVelocity = DEFAULT_VELOCITY;
    // Divisions in effect for the current measure. Sticky: a measure without a
    // <divisions> inherits the previous one.
    let measureDivisions = firstDivisions;
    // Absolute beat on the shared grid at the start of the current measure.
    let gridBeat = 0;

    function getVoiceState(voice: string): VoiceState {
      if (!voiceStates.has(voice)) {
        voiceStates.set(voice, {
          intraBeat: 0,
          tiedPitch: null,
          tiedStartBeat: 0,
          tiedDurationBeats: 0,
          tiedMidi: 0,
          tiedFrequency: 0,
          tiedVelocity: DEFAULT_VELOCITY,
        });
      }
      return voiceStates.get(voice)!;
    }

    for (const measureIdx of measureOrder) {
      const measure = measures[measureIdx];
      const elements = getMeasureElements(measure);

      // Pick up this measure's divisions if it declares one (sticky otherwise).
      const measureDivStr = getTagContent(measure, "divisions");
      if (measureDivStr) {
        const parsed = parseInt(measureDivStr, 10);
        if (parsed > 0) measureDivisions = parsed;
      }

      const barBeats = barBeatsByMeasure[measureIdx] ?? DEFAULT_BAR_BEATS;
      // Compress only an over-full bar so it fits; never stretch a short bar.
      const contentBeats = measureContentBeats(measure, measureDivisions);
      const scale = contentBeats > barBeats ? barBeats / contentBeats : 1;

      // Every voice restarts at the measure's grid anchor.
      for (const st of voiceStates.values()) st.intraBeat = 0;
      // Track each voice's last non-chord onset (intra-measure) for chords.
      const lastNoteIntra = new Map<string, number>();

      for (const element of elements) {
        if (element.type === "direction") {
          const dynVelocity = parseDynamicsFromDirection(element.xml);
          if (dynVelocity !== null) {
            currentVelocity = dynVelocity;
          }
          continue;
        }

        // element.type === "note"
        const noteXml = element.xml;
        const isRest = noteXml.includes("<rest");
        const isChord = noteXml.includes("<chord");

        // Determine voice (default "1")
        const voiceStr = getTagContent(noteXml, "voice") ?? "1";
        const state = getVoiceState(voiceStr);

        // Duration in quarter-note beats — divide raw divisions by THIS measure's
        // divisions so the value is comparable across measures with different ones.
        const durationStr = getTagContent(noteXml, "duration");
        const durationDivisions = durationStr ? parseInt(durationStr, 10) : measureDivisions;
        const durationBeats = measureDivisions > 0 ? durationDivisions / measureDivisions : durationDivisions;

        // Check for tie
        const hasTieStart = noteXml.includes('<tie type="start"');
        const hasTieStop = noteXml.includes('<tie type="stop"');

        // Onset within the measure (raw beats), then mapped onto the shared grid.
        const startIntra = isChord
          ? (lastNoteIntra.get(voiceStr) ?? state.intraBeat)
          : state.intraBeat;
        const absStartBeat = gridBeat + startIntra * scale;
        const scaledDurBeats = durationBeats * scale;

        if (isRest) {
          // Flush any pending tied note for this voice
          if (state.tiedPitch !== null) {
            pushNote({
              pitch: state.tiedPitch,
              midiNumber: state.tiedMidi,
              frequency: state.tiedFrequency,
              startTime: state.tiedStartBeat * secondsPerBeat,
              duration: state.tiedDurationBeats * secondsPerBeat,
              velocity: state.tiedVelocity,
            });
            state.tiedPitch = null;
          }
          state.intraBeat += durationBeats;
          lastNoteIntra.set(voiceStr, state.intraBeat);
          continue;
        }

        // Check for unpitched (x-noteheads / spoken rhythm) — percussive hit
        const isUnpitched = noteXml.includes("<unpitched");

        // Parse pitch (or use default for unpitched)
        let step: string | null;
        let octaveStr: string | null;
        let alterStr: string | null;

        if (isUnpitched) {
          step = getTagContent(noteXml, "display-step") ?? "B";
          octaveStr = getTagContent(noteXml, "display-octave") ?? "4";
          alterStr = step === "B" ? "-1" : null; // Bb for spoken rhythm
        } else {
          step = getTagContent(noteXml, "step");
          octaveStr = getTagContent(noteXml, "octave");
          alterStr = getTagContent(noteXml, "alter");
        }

        if (!step || !octaveStr) {
          if (!isChord) {
            lastNoteIntra.set(voiceStr, startIntra);
            state.intraBeat += durationBeats;
          }
          continue;
        }

        const octave = parseInt(octaveStr, 10);
        // Use explicit alter if present, otherwise apply key signature
        let alter: number;
        if (alterStr !== null) {
          alter = parseInt(alterStr, 10);
        } else {
          alter = keyAccidentals[step] ?? 0;
        }
        const noteName = pitchToNoteName(step, alter);
        const pitch = noteName + octave;
        const midiNumber = noteNameToMidi(noteName, octave);
        const frequency = noteToFrequency(noteName, octave);

        if (hasTieStop && state.tiedPitch === pitch) {
          // Continue the tied note
          state.tiedDurationBeats += scaledDurBeats;

          if (!hasTieStart) {
            // Tie ends here — flush
            pushNote({
              pitch: state.tiedPitch,
              midiNumber: state.tiedMidi,
              frequency: state.tiedFrequency,
              startTime: state.tiedStartBeat * secondsPerBeat,
              duration: state.tiedDurationBeats * secondsPerBeat,
              velocity: state.tiedVelocity,
            });
            state.tiedPitch = null;
          }
        } else {
          // Flush any previous tied note for this voice
          if (state.tiedPitch !== null) {
            pushNote({
              pitch: state.tiedPitch,
              midiNumber: state.tiedMidi,
              frequency: state.tiedFrequency,
              startTime: state.tiedStartBeat * secondsPerBeat,
              duration: state.tiedDurationBeats * secondsPerBeat,
              velocity: state.tiedVelocity,
            });
            state.tiedPitch = null;
          }

          if (hasTieStart) {
            // Start a new tie
            state.tiedPitch = pitch;
            state.tiedStartBeat = absStartBeat;
            state.tiedDurationBeats = scaledDurBeats;
            state.tiedMidi = midiNumber;
            state.tiedFrequency = frequency;
            state.tiedVelocity = currentVelocity;
          } else {
            // Normal note
            pushNote({
              pitch,
              midiNumber,
              frequency,
              startTime: absStartBeat * secondsPerBeat,
              duration: scaledDurBeats * secondsPerBeat,
              velocity: currentVelocity,
            });
          }
        }

        if (!isChord) {
          lastNoteIntra.set(voiceStr, startIntra);
          state.intraBeat += durationBeats;
        }
      }

      // Advance the shared grid by exactly one bar — identical for every part.
      gridBeat += barBeats;
    }

    // Flush any remaining tied notes across all voices in this part
    for (const state of voiceStates.values()) {
      if (state.tiedPitch !== null) {
        pushNote({
          pitch: state.tiedPitch,
          midiNumber: state.tiedMidi,
          frequency: state.tiedFrequency,
          startTime: state.tiedStartBeat * secondsPerBeat,
          duration: state.tiedDurationBeats * secondsPerBeat,
          velocity: state.tiedVelocity,
        });
      }
    }
  } // end of parts loop

  // Sort merged notes from all parts by startTime, keeping notePartIndices in lockstep
  const zipped = sequence.map((note, i) => ({ note, partIdx: notePartIndices[i] }));
  zipped.sort((a, b) => a.note.startTime - b.note.startTime || a.note.midiNumber - b.note.midiNumber);
  const sortedNotes = zipped.map((z) => z.note);
  const sortedIndices = zipped.map((z) => z.partIdx);

  const totalDuration = sortedNotes.length > 0
    ? Math.max(...sortedNotes.map((n) => n.startTime + n.duration))
    : 0;
  console.log(`[MusicXmlParser] parsed ${allPartXmls.length} parts → ${sortedNotes.length} notes, tempo=${tempo}, firstDivisions=${firstDivisions}, totalDuration=${totalDuration.toFixed(2)}s`);
  if (sortedNotes.length > 0) {
    console.log(`[MusicXmlParser] first note: ${sortedNotes[0].pitch} at ${sortedNotes[0].startTime.toFixed(3)}s dur=${sortedNotes[0].duration.toFixed(3)}s`);
    const last = sortedNotes[sortedNotes.length - 1];
    console.log(`[MusicXmlParser] last note: ${last.pitch} at ${last.startTime.toFixed(3)}s dur=${last.duration.toFixed(3)}s`);
  }

  return { notes: sortedNotes, parts, notePartIndices: sortedIndices };
}

/** Sample MusicXML for testing — first 4 bars of "Twinkle Twinkle Little Star" in C major */
export const SAMPLE_MUSICXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Melody</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction>
        <sound tempo="120"/>
      </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
    </measure>
    <measure number="3">
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="4">
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
    </measure>
  </part>
</score-partwise>`;

/** Sample polyphonic MusicXML — C major chord (C4+E4+G4) followed by G4 */
export const SAMPLE_POLYPHONIC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction><sound tempo="120"/></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;

/** Sample MusicXML with dynamics markings */
export const SAMPLE_DYNAMICS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction><sound tempo="120"/></direction>
      <direction><direction-type><dynamics><p/></dynamics></direction-type></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <direction><direction-type><dynamics><ff/></dynamics></direction-type></direction>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;

/** Sample MusicXML with forward/backward repeats (2/4 — two beats per bar) */
export const SAMPLE_REPEAT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>2</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction><sound tempo="120"/></direction>
      <barline location="left"><repeat direction="forward"/></barline>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <barline location="right"><repeat direction="backward"/></barline>
    </measure>
    <measure number="2">
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;

/** Sample MusicXML with key signature (G major, fifths=1, F is automatically F#) */
export const SAMPLE_KEY_SIGNATURE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>1</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction><sound tempo="120"/></direction>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><alter>0</alter><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;

/** Sample MusicXML with two voices */
export const SAMPLE_TWO_VOICES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction><sound tempo="120"/></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>half</type></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>1</duration><voice>2</voice><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>half</type></note>
      <note><pitch><step>F</step><octave>5</octave></pitch><duration>1</duration><voice>2</voice><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;
