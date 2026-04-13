import {
  parsePitchString,
  formatPitchString,
  findNoteRange,
  replaceNotePitch,
} from "../../../../client/lib/audio/musicXmlEditor";
import {
  SAMPLE_MUSICXML,
  parseMusicXml,
} from "../../../../client/lib/audio/musicXmlParser";

// Minimal 2-note fixture: C4 at t=0s, G4 at t=0.5s (tempo=120, divisions=1)
const TWO_NOTE_XML = `<?xml version="1.0"?>
<score-partwise>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <direction><sound tempo="120"/></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
</score-partwise>`;

describe("parsePitchString", () => {
  it('parses "C4" into step C, alter 0, octave 4', () => {
    expect(parsePitchString("C4")).toEqual({ step: "C", alter: 0, octave: 4 });
  });

  it('parses "C#4" into step C, alter 1, octave 4', () => {
    expect(parsePitchString("C#4")).toEqual({ step: "C", alter: 1, octave: 4 });
  });

  it('parses "D#5" into step D, alter 1, octave 5', () => {
    expect(parsePitchString("D#5")).toEqual({ step: "D", alter: 1, octave: 5 });
  });

  it('parses "B2" into step B, alter 0, octave 2', () => {
    expect(parsePitchString("B2")).toEqual({ step: "B", alter: 0, octave: 2 });
  });

  it('parses "G#3" into step G, alter 1, octave 3', () => {
    expect(parsePitchString("G#3")).toEqual({ step: "G", alter: 1, octave: 3 });
  });

  it('returns null for invalid step "Z9"', () => {
    expect(parsePitchString("Z9")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parsePitchString("")).toBeNull();
  });
});

describe("formatPitchString", () => {
  it('formats step C, alter 0, octave 4 as "C4"', () => {
    expect(formatPitchString("C", 0, 4)).toBe("C4");
  });

  it('formats step D, alter 1, octave 5 as "D#5"', () => {
    expect(formatPitchString("D", 1, 5)).toBe("D#5");
  });

  it('formats step A, alter 0, octave 3 as "A3"', () => {
    expect(formatPitchString("A", 0, 3)).toBe("A3");
  });
});

describe("findNoteRange", () => {
  it("finds C4 at t=0.0s and the slice contains <step>C</step>", () => {
    const result = findNoteRange(TWO_NOTE_XML, "C", 4, 0.0);
    expect(result).not.toBeNull();
    expect(typeof result!.start).toBe("number");
    expect(typeof result!.end).toBe("number");
    expect(result!.start).toBeLessThan(result!.end);
    expect(TWO_NOTE_XML.slice(result!.start, result!.end)).toContain(
      "<step>C</step>",
    );
  });

  it("finds G4 at t=0.5s and the slice contains <step>G</step>", () => {
    const result = findNoteRange(TWO_NOTE_XML, "G", 4, 0.5);
    expect(result).not.toBeNull();
    expect(TWO_NOTE_XML.slice(result!.start, result!.end)).toContain(
      "<step>G</step>",
    );
  });

  it("returns null when no note exists at t=9.0s", () => {
    const result = findNoteRange(TWO_NOTE_XML, "C", 4, 9.0);
    expect(result).toBeNull();
  });

  it("returns null when step Z does not exist in the XML", () => {
    const result = findNoteRange(TWO_NOTE_XML, "Z", 4, 0.0);
    expect(result).toBeNull();
  });
});

describe("replaceNotePitch", () => {
  const noteSequence = parseMusicXml(SAMPLE_MUSICXML);

  it("replaces the first note (C4 at t≈0s) with G4 — re-parsed first note is G4", () => {
    const updated = replaceNotePitch(SAMPLE_MUSICXML, noteSequence, 0, "G", 0, 4);
    const reparsed = parseMusicXml(updated);
    // The note that was at t≈0 should now be G4
    const atZero = reparsed.find((n) => Math.abs(n.startTime) < 0.05);
    expect(atZero).toBeDefined();
    expect(atZero!.pitch).toBe("G4");
  });

  it("replaces note at index 2 (G4 at t≈1s) with A4 — re-parsed note at that time is A4", () => {
    const originalNote = noteSequence[2];
    const updated = replaceNotePitch(
      SAMPLE_MUSICXML,
      noteSequence,
      2,
      "A",
      0,
      4,
    );
    const reparsed = parseMusicXml(updated);
    const nearOriginalTime = reparsed.find(
      (n) => Math.abs(n.startTime - originalNote.startTime) < 0.05,
    );
    expect(nearOriginalTime).toBeDefined();
    expect(nearOriginalTime!.pitch).toBe("A4");
  });

  it("returns original XML unchanged for invalid index -1", () => {
    const updated = replaceNotePitch(SAMPLE_MUSICXML, noteSequence, -1, "G", 0, 4);
    expect(updated).toBe(SAMPLE_MUSICXML);
  });

  it("returns original XML unchanged for index beyond noteSequence length", () => {
    const updated = replaceNotePitch(
      SAMPLE_MUSICXML,
      noteSequence,
      noteSequence.length + 10,
      "G",
      0,
      4,
    );
    expect(updated).toBe(SAMPLE_MUSICXML);
  });
});
