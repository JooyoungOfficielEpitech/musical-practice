/**
 * Tests for client/lib/audio/noteEditLocator.ts
 * Maps a tapped note (part + midi + occurrence) to its <note> block index in
 * XML document order. Must mirror the audio parser's pitch rules exactly:
 * explicit <alter> wins, otherwise the key signature applies.
 */
import {
  findXmlNoteIndex,
  computeNoteOccurrence,
} from "../../../../client/lib/audio/noteEditLocator";
import type { NoteEvent } from "../../../../client/types/music";

const TWO_PART_XML = `<?xml version="1.0"?>
<score-partwise>
  <part-list>
    <score-part id="P1"><part-name>Sop</part-name></score-part>
    <score-part id="P2"><part-name>Alto</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>0</fifths></key></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><rest/><duration>1</duration></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration></note>
    </measure>
  </part>
</score-partwise>`;

// G major (fifths=1): written F is effectively F# unless an explicit alter says otherwise.
const KEY_SIG_XML = `<score-partwise>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>1</fifths></key></attributes>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><pitch><step>F</step><alter>0</alter><octave>4</octave></pitch><duration>1</duration></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
</score-partwise>`;

// Bb in the score (explicit flat) — the parser labels it "A#" (enharmonic).
const FLAT_XML = `<score-partwise>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>0</fifths></key></attributes>
      <note><pitch><step>B</step><alter>-1</alter><octave>3</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
</score-partwise>`;

const REPEAT_XML = `<score-partwise>
  <part id="P1">
    <measure number="1">
      <barline location="right"><repeat direction="backward"/></barline>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
</score-partwise>`;

describe("findXmlNoteIndex — midi-based matching", () => {
  it("finds the nth occurrence of a midi pitch within a part (rests skipped, counted in index)", () => {
    // C4 = midi 60. Second occurrence in P1 is the 3rd <note> block (index 2).
    expect(findXmlNoteIndex(TWO_PART_XML, { partIndex: 0, midiNumber: 60, occurrence: 1 })).toBe(2);
    expect(findXmlNoteIndex(TWO_PART_XML, { partIndex: 0, midiNumber: 60, occurrence: 0 })).toBe(0);
  });

  it("scopes occurrence counting to the given part with a global index result", () => {
    // P2's C4 is occurrence 0 in P2; global index = 4 notes in P1 + 0.
    expect(findXmlNoteIndex(TWO_PART_XML, { partIndex: 1, midiNumber: 60, occurrence: 0 })).toBe(4);
    // G3 = midi 55 → global index 5.
    expect(findXmlNoteIndex(TWO_PART_XML, { partIndex: 1, midiNumber: 55, occurrence: 0 })).toBe(5);
  });

  it("returns null when the occurrence does not exist", () => {
    expect(findXmlNoteIndex(TWO_PART_XML, { partIndex: 0, midiNumber: 60, occurrence: 5 })).toBeNull();
    expect(findXmlNoteIndex(TWO_PART_XML, { partIndex: 9, midiNumber: 60, occurrence: 0 })).toBeNull();
  });

  it("applies the key signature: written F in G major matches midi F#(66), explicit natural matches 65", () => {
    expect(findXmlNoteIndex(KEY_SIG_XML, { partIndex: 0, midiNumber: 66, occurrence: 0 })).toBe(0);
    expect(findXmlNoteIndex(KEY_SIG_XML, { partIndex: 0, midiNumber: 65, occurrence: 0 })).toBe(1);
    expect(findXmlNoteIndex(KEY_SIG_XML, { partIndex: 0, midiNumber: 66, occurrence: 1 })).toBe(2);
  });

  it("matches enharmonics by midi number (score Bb3 ↔ parser label A#3, midi 58)", () => {
    expect(findXmlNoteIndex(FLAT_XML, { partIndex: 0, midiNumber: 58, occurrence: 0 })).toBe(0);
  });

  it("refuses to locate anything in a score with repeats (expansion breaks occurrence counting)", () => {
    expect(findXmlNoteIndex(REPEAT_XML, { partIndex: 0, midiNumber: 60, occurrence: 0 })).toBeNull();
  });

  it("refuses multi-voice parts (XML order and playback order diverge)", () => {
    const multiVoice = `<score-partwise><part id="P1"><measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>2</voice></note>
    </measure></part></score-partwise>`;
    expect(findXmlNoteIndex(multiVoice, { partIndex: 0, midiNumber: 60, occurrence: 0 })).toBeNull();
  });
});

describe("computeNoteOccurrence", () => {
  function note(midi: number, start: number): NoteEvent {
    return { pitch: "X", midiNumber: midi, frequency: 440, startTime: start, duration: 1, velocity: 80 };
  }

  it("counts prior same-part same-midi notes in time order", () => {
    const notes = [note(60, 0), note(60, 0.5), note(64, 1), note(60, 2)];
    const partIndices = [0, 1, 0, 0];
    // notes[3] is the SECOND midi-60 note of part 0 (notes[1] belongs to part 1).
    expect(computeNoteOccurrence(notes, partIndices, 3)).toBe(1);
    expect(computeNoteOccurrence(notes, partIndices, 0)).toBe(0);
    expect(computeNoteOccurrence(notes, partIndices, 1)).toBe(0);
  });
});

describe("findXmlNoteIndex — tied notes", () => {
  // C4 tied across two blocks (ONE played note), then a separate C4.
  const TIE_XML = `<score-partwise>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>0</fifths></key></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><tie type="start"/></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><tie type="stop"/></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
</score-partwise>`;

  it("does not count tie continuations, so occurrence matches the played sequence", () => {
    // Played C4 events: [tied pair]=occ 0, plain C4=occ 1 → plain C4 is block index 2.
    expect(findXmlNoteIndex(TIE_XML, { partIndex: 0, midiNumber: 60, occurrence: 1 })).toBe(2);
  });

  it("refuses to edit a note that participates in a tie", () => {
    // Occurrence 0 is the tied note — editing only half a tie corrupts it.
    expect(findXmlNoteIndex(TIE_XML, { partIndex: 0, midiNumber: 60, occurrence: 0 })).toBeNull();
  });

  it("still edits untied notes in the same part", () => {
    expect(findXmlNoteIndex(TIE_XML, { partIndex: 0, midiNumber: 64, occurrence: 0 })).toBe(3);
  });
});

describe("findXmlNoteIndex — lyric-bearing notes", () => {
  it("locates and matches notes regardless of <lyric> children", () => {
    const xml = `<score-partwise><part id="P1"><measure number="1">
      <attributes><divisions>1</divisions><key><fifths>0</fifths></key></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration>
        <lyric><syllabic>single</syllabic><text>가</text></lyric></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration>
        <lyric><syllabic>single</syllabic><text>나</text></lyric></note>
    </measure></part></score-partwise>`;
    expect(findXmlNoteIndex(xml, { partIndex: 0, midiNumber: 60, occurrence: 1 })).toBe(1);
  });
});
