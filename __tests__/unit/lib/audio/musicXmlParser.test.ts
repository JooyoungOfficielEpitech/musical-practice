import {
  parseMusicXml,
  SAMPLE_MUSICXML,
  SAMPLE_POLYPHONIC_XML,
  SAMPLE_DYNAMICS_XML,
  SAMPLE_REPEAT_XML,
  SAMPLE_KEY_SIGNATURE_XML,
  SAMPLE_TWO_VOICES_XML,
} from "../../../../client/lib/audio/musicXmlParser";
import type { NoteEvent } from "../../../../client/types/music";

describe("musicXmlParser", () => {
  describe("parseMusicXml with SAMPLE_MUSICXML", () => {
    let notes: NoteEvent[];

    beforeAll(() => {
      notes = parseMusicXml(SAMPLE_MUSICXML).notes;
    });

    it("parses the correct number of notes", () => {
      // Twinkle Twinkle: C C G G A A G | F F E E D D C
      // Measure 1: 4 quarter notes, Measure 2: 2 quarter + 1 half = 3 notes
      // Measure 3: 4 quarter notes, Measure 4: 2 quarter + 1 half = 3 notes
      // Total: 14 notes
      expect(notes).toHaveLength(14);
    });

    it("parses the first note as C4", () => {
      expect(notes[0].pitch).toBe("C4");
    });

    it("calculates correct MIDI numbers", () => {
      // C4 = MIDI 60
      expect(notes[0].midiNumber).toBe(60);
      // G4 = MIDI 67
      expect(notes[2].midiNumber).toBe(67);
      // A4 = MIDI 69
      expect(notes[4].midiNumber).toBe(69);
    });

    it("calculates correct frequencies", () => {
      // C4 ~261.63 Hz
      expect(notes[0].frequency).toBeCloseTo(261.63, 0);
      // G4 ~392.00 Hz
      expect(notes[2].frequency).toBeCloseTo(392.0, 0);
      // A4 = 440 Hz
      expect(notes[4].frequency).toBeCloseTo(440.0, 0);
    });

    it("calculates correct start times at 120 BPM", () => {
      // At 120 BPM, one beat (quarter note) = 0.5s
      // divisions=1, so 1 division = 0.5s
      expect(notes[0].startTime).toBeCloseTo(0, 3);
      expect(notes[1].startTime).toBeCloseTo(0.5, 3);
      expect(notes[2].startTime).toBeCloseTo(1.0, 3);
      expect(notes[3].startTime).toBeCloseTo(1.5, 3);
    });

    it("calculates correct durations", () => {
      // Quarter note at 120 BPM = 0.5s
      expect(notes[0].duration).toBeCloseTo(0.5, 3);
      // Half note (duration=2) at 120 BPM = 1.0s (measure 2, last note: G4)
      expect(notes[6].duration).toBeCloseTo(1.0, 3);
    });

    it("sets velocity to default value", () => {
      for (const note of notes) {
        expect(note.velocity).toBe(80);
      }
    });

    it("produces notes in chronological order", () => {
      for (let i = 1; i < notes.length; i++) {
        expect(notes[i].startTime).toBeGreaterThanOrEqual(notes[i - 1].startTime);
      }
    });

    it("parses the correct melody sequence", () => {
      const pitches = notes.map((n) => n.pitch);
      expect(pitches).toEqual([
        "C4", "C4", "G4", "G4",   // measure 1
        "A4", "A4", "G4",          // measure 2
        "F4", "F4", "E4", "E4",   // measure 3
        "D4", "D4", "C4",          // measure 4
      ]);
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty XML", () => {
      expect(parseMusicXml("").notes).toEqual([]);
    });

    it("returns empty array for XML with no notes", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
          </measure>
        </part>
      </score-partwise>`;
      expect(parseMusicXml(xml).notes).toEqual([]);
    });

    it("handles rests correctly (advances time but no note)", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><rest/><duration>1</duration></note>
            <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;

      const { notes } = parseMusicXml(xml);
      expect(notes).toHaveLength(2);
      expect(notes[0].pitch).toBe("C4");
      expect(notes[0].startTime).toBeCloseTo(0, 3);
      // E4 starts after C4 (0.5s) + rest (0.5s) = 1.0s
      expect(notes[1].pitch).toBe("E4");
      expect(notes[1].startTime).toBeCloseTo(1.0, 3);
    });

    it("handles sharps (alter=1)", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;

      const { notes } = parseMusicXml(xml);
      expect(notes).toHaveLength(1);
      expect(notes[0].pitch).toBe("F#4");
      expect(notes[0].midiNumber).toBe(66); // F#4
    });

    it("handles flats (alter=-1)", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;

      const { notes } = parseMusicXml(xml);
      expect(notes).toHaveLength(1);
      expect(notes[0].pitch).toBe("A#4"); // Bb4 -> A#4
      expect(notes[0].midiNumber).toBe(70);
    });

    it("handles ties (merges tied notes into one)", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <note>
              <pitch><step>C</step><octave>4</octave></pitch>
              <duration>1</duration>
              <tie type="start"/>
            </note>
            <note>
              <pitch><step>C</step><octave>4</octave></pitch>
              <duration>1</duration>
              <tie type="stop"/>
            </note>
          </measure>
        </part>
      </score-partwise>`;

      const { notes } = parseMusicXml(xml);
      expect(notes).toHaveLength(1);
      expect(notes[0].pitch).toBe("C4");
      // Two quarter notes tied = 1.0s at 120 BPM
      expect(notes[0].duration).toBeCloseTo(1.0, 3);
    });

    it("parses chord notes with same startTime (polyphonic mode)", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;

      const { notes } = parseMusicXml(xml);
      expect(notes).toHaveLength(3);
      expect(notes[0].pitch).toBe("C4");
      expect(notes[1].pitch).toBe("E4");
      // Chord notes share the same startTime
      expect(notes[0].startTime).toBeCloseTo(notes[1].startTime, 3);
      // G4 comes after the chord
      expect(notes[2].pitch).toBe("G4");
      expect(notes[2].startTime).toBeCloseTo(0.5, 3);
    });

    it("uses default tempo of 120 BPM when none specified", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;

      const { notes } = parseMusicXml(xml);
      // Default 120 BPM => 0.5s per quarter
      expect(notes[0].startTime).toBeCloseTo(0, 3);
      expect(notes[1].startTime).toBeCloseTo(0.5, 3);
    });

    it("handles higher divisions value", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>2</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration></note>
            <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;

      const { notes } = parseMusicXml(xml);
      // divisions=2, so 1 division = 0.25s at 120 BPM
      // C4: duration=2 divisions = 0.5s (quarter note)
      expect(notes[0].duration).toBeCloseTo(0.5, 3);
      // D4: duration=1 division = 0.25s (eighth note)
      expect(notes[1].duration).toBeCloseTo(0.25, 3);
      expect(notes[1].startTime).toBeCloseTo(0.5, 3);
    });
  });

  describe("polyphonic — chords", () => {
    it("parses a C major chord as 3 simultaneous notes", () => {
      const { notes } = parseMusicXml(SAMPLE_POLYPHONIC_XML);
      expect(notes).toHaveLength(4);
      expect(notes[0].pitch).toBe("C4");
      expect(notes[1].pitch).toBe("E4");
      expect(notes[2].pitch).toBe("G4");
      expect(notes[0].startTime).toBeCloseTo(0, 3);
      expect(notes[1].startTime).toBeCloseTo(0, 3);
      expect(notes[2].startTime).toBeCloseTo(0, 3);
      expect(notes[3].pitch).toBe("G4");
      expect(notes[3].startTime).toBeCloseTo(0.5, 3);
    });

    it("chord notes all have correct duration", () => {
      const { notes } = parseMusicXml(SAMPLE_POLYPHONIC_XML);
      for (const note of notes) {
        expect(note.duration).toBeCloseTo(0.5, 3);
      }
    });

    it("chord notes have correct MIDI numbers", () => {
      const { notes } = parseMusicXml(SAMPLE_POLYPHONIC_XML);
      expect(notes[0].midiNumber).toBe(60); // C4
      expect(notes[1].midiNumber).toBe(64); // E4
      expect(notes[2].midiNumber).toBe(67); // G4
    });

    it("chord notes have correct frequencies", () => {
      const { notes } = parseMusicXml(SAMPLE_POLYPHONIC_XML);
      expect(notes[0].frequency).toBeCloseTo(261.63, 0); // C4
      expect(notes[1].frequency).toBeCloseTo(329.63, 0); // E4
      expect(notes[2].frequency).toBeCloseTo(392.0, 0);  // G4
    });

    it("handles consecutive chords", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><chord/><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;

      const { notes } = parseMusicXml(xml);
      expect(notes).toHaveLength(4);
      // First chord at t=0
      expect(notes[0].startTime).toBeCloseTo(0, 3);
      expect(notes[1].startTime).toBeCloseTo(0, 3);
      // Second chord at t=0.5
      expect(notes[2].startTime).toBeCloseTo(0.5, 3);
      expect(notes[3].startTime).toBeCloseTo(0.5, 3);
    });

    it("handles a 4-note chord", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><chord/><pitch><step>B</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;

      const { notes } = parseMusicXml(xml);
      expect(notes).toHaveLength(4);
      const pitches = notes.map((n) => n.pitch);
      expect(pitches).toEqual(["C4", "E4", "G4", "B4"]);
      // All at same time
      for (const note of notes) {
        expect(note.startTime).toBeCloseTo(0, 3);
      }
    });

    it("advances time correctly after a chord", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration></note>
            <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration></note>
            <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;

      const { notes } = parseMusicXml(xml);
      expect(notes).toHaveLength(3);
      // Chord duration is 2 divisions = 1.0s at 120 BPM
      expect(notes[0].duration).toBeCloseTo(1.0, 3);
      expect(notes[1].duration).toBeCloseTo(1.0, 3);
      // G4 starts after the chord's duration (1.0s), not after both notes
      expect(notes[2].startTime).toBeCloseTo(1.0, 3);
    });
  });

  describe("dynamics", () => {
    it("applies piano (p) velocity to initial notes", () => {
      const { notes } = parseMusicXml(SAMPLE_DYNAMICS_XML);
      expect(notes).toHaveLength(4);
      expect(notes[0].velocity).toBe(40);
      expect(notes[1].velocity).toBe(40);
    });

    it("applies ff velocity after dynamic change", () => {
      const { notes } = parseMusicXml(SAMPLE_DYNAMICS_XML);
      expect(notes[2].velocity).toBe(110);
      expect(notes[3].velocity).toBe(110);
    });

    it("parses correct pitches with dynamics", () => {
      const { notes } = parseMusicXml(SAMPLE_DYNAMICS_XML);
      expect(notes.map((n) => n.pitch)).toEqual(["C4", "D4", "E4", "F4"]);
    });

    it("does not affect timing when dynamics are present", () => {
      const { notes } = parseMusicXml(SAMPLE_DYNAMICS_XML);
      expect(notes[0].startTime).toBeCloseTo(0, 3);
      expect(notes[1].startTime).toBeCloseTo(0.5, 3);
      expect(notes[2].startTime).toBeCloseTo(1.0, 3);
      expect(notes[3].startTime).toBeCloseTo(1.5, 3);
    });

    it("maps pp to velocity 20", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <direction><direction-type><dynamics><pp/></dynamics></direction-type></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
      const { notes } = parseMusicXml(xml);
      expect(notes[0].velocity).toBe(20);
    });

    it("maps mp to velocity 55", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <direction><direction-type><dynamics><mp/></dynamics></direction-type></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
      const { notes } = parseMusicXml(xml);
      expect(notes[0].velocity).toBe(55);
    });

    it("maps mf to velocity 70", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <direction><direction-type><dynamics><mf/></dynamics></direction-type></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
      const { notes } = parseMusicXml(xml);
      expect(notes[0].velocity).toBe(70);
    });

    it("maps f to velocity 90", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <direction><direction-type><dynamics><f/></dynamics></direction-type></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
      const { notes } = parseMusicXml(xml);
      expect(notes[0].velocity).toBe(90);
    });

    it("maps fff to velocity 127", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <direction><direction-type><dynamics><fff/></dynamics></direction-type></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
      const { notes } = parseMusicXml(xml);
      expect(notes[0].velocity).toBe(127);
    });

    it("uses default velocity when no dynamics specified", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
      const { notes } = parseMusicXml(xml);
      expect(notes[0].velocity).toBe(80);
    });

    it("dynamics persist across measures", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <direction><direction-type><dynamics><f/></dynamics></direction-type></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
          <measure number="2">
            <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
      const { notes } = parseMusicXml(xml);
      expect(notes[0].velocity).toBe(90);
      expect(notes[1].velocity).toBe(90);
    });

    it("applies dynamics to chord notes", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <direction><direction-type><dynamics><ff/></dynamics></direction-type></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
      const { notes } = parseMusicXml(xml);
      expect(notes[0].velocity).toBe(110);
      expect(notes[1].velocity).toBe(110);
    });
  });

  describe("repeats", () => {
    it("repeats the section between forward and backward repeat barlines", () => {
      const { notes } = parseMusicXml(SAMPLE_REPEAT_XML);
      expect(notes).toHaveLength(5);
      expect(notes.map((n) => n.pitch)).toEqual(["C4", "D4", "C4", "D4", "E4"]);
    });

    it("has correct timing for repeated notes", () => {
      const { notes } = parseMusicXml(SAMPLE_REPEAT_XML);
      expect(notes[0].startTime).toBeCloseTo(0, 3);
      expect(notes[1].startTime).toBeCloseTo(0.5, 3);
      expect(notes[2].startTime).toBeCloseTo(1.0, 3);
      expect(notes[3].startTime).toBeCloseTo(1.5, 3);
      expect(notes[4].startTime).toBeCloseTo(2.0, 3);
    });

    it("repeated notes have correct durations", () => {
      const { notes } = parseMusicXml(SAMPLE_REPEAT_XML);
      for (const note of notes) {
        expect(note.duration).toBeCloseTo(0.5, 3);
      }
    });

    it("handles no repeats (plays straight through)", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
          <measure number="2">
            <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
      const { notes } = parseMusicXml(xml);
      expect(notes).toHaveLength(2);
      expect(notes.map((n) => n.pitch)).toEqual(["C4", "D4"]);
    });

    it("handles multi-measure repeat section", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <barline location="left"><repeat direction="forward"/></barline>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
          <measure number="2">
            <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note>
            <barline location="right"><repeat direction="backward"/></barline>
          </measure>
          <measure number="3">
            <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;

      const { notes } = parseMusicXml(xml);
      // Measures 1-2 twice, then measure 3
      expect(notes).toHaveLength(5);
      expect(notes.map((n) => n.pitch)).toEqual(["C4", "D4", "C4", "D4", "E4"]);
    });

    it("backward repeat defaults to beginning when no forward repeat", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
          <measure number="2">
            <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note>
            <barline location="right"><repeat direction="backward"/></barline>
          </measure>
        </part>
      </score-partwise>`;

      const { notes } = parseMusicXml(xml);
      // Both measures repeated from beginning
      expect(notes).toHaveLength(4);
      expect(notes.map((n) => n.pitch)).toEqual(["C4", "D4", "C4", "D4"]);
    });
  });

  describe("key signatures", () => {
    it("applies key signature accidentals to notes without explicit alter", () => {
      const { notes } = parseMusicXml(SAMPLE_KEY_SIGNATURE_XML);
      expect(notes).toHaveLength(4);
      expect(notes[0].pitch).toBe("G4");
      expect(notes[1].pitch).toBe("A4");
      expect(notes[2].pitch).toBe("F#4");
      expect(notes[2].midiNumber).toBe(66);
    });

    it("respects explicit alter=0 override over key signature", () => {
      const { notes } = parseMusicXml(SAMPLE_KEY_SIGNATURE_XML);
      expect(notes[3].pitch).toBe("F4");
      expect(notes[3].midiNumber).toBe(65);
    });

    it("key of C major (fifths=0) applies no accidentals", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions><key><fifths>0</fifths></key></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><pitch><step>B</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
      const { notes } = parseMusicXml(xml);
      expect(notes[0].pitch).toBe("F4");
      expect(notes[1].pitch).toBe("B4");
    });

    it("key of D major (fifths=2) sharps F and C", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions><key><fifths>2</fifths></key></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration></note>
            <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
      const { notes } = parseMusicXml(xml);
      expect(notes[0].pitch).toBe("F#4");
      expect(notes[1].pitch).toBe("C#5");
      // G is not affected
      expect(notes[2].pitch).toBe("G4");
    });

    it("key of F major (fifths=-1) flats B", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions><key><fifths>-1</fifths></key></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>B</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
      const { notes } = parseMusicXml(xml);
      // Bb -> A# in our notation
      expect(notes[0].pitch).toBe("A#4");
      expect(notes[0].midiNumber).toBe(70);
      // E is not affected
      expect(notes[1].pitch).toBe("E4");
    });

    it("key of Eb major (fifths=-3) flats B, E, and A", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions><key><fifths>-3</fifths></key></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>B</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
      const { notes } = parseMusicXml(xml);
      expect(notes[0].pitch).toBe("A#4"); // Bb
      expect(notes[1].pitch).toBe("D#4"); // Eb
      expect(notes[2].pitch).toBe("G#4"); // Ab
      // C is not affected
      expect(notes[3].pitch).toBe("C4");
    });

    it("explicit alter overrides key signature sharp", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions><key><fifths>1</fifths></key></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>F</step><alter>-1</alter><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
      const { notes } = parseMusicXml(xml);
      // Key says F#, but explicit alter=-1 means Fb -> E
      expect(notes[0].pitch).toBe("E4");
    });
  });

  describe("multiple voices", () => {
    it("parses notes from both voices", () => {
      const { notes } = parseMusicXml(SAMPLE_TWO_VOICES_XML);
      expect(notes).toHaveLength(4);
    });

    it("tracks time independently per voice", () => {
      const { notes } = parseMusicXml(SAMPLE_TWO_VOICES_XML);
      const pitches = notes.map((n) => n.pitch);
      expect(pitches[0]).toBe("C4");
      expect(pitches[1]).toBe("E5");
      expect(notes[0].startTime).toBeCloseTo(0, 3);
      expect(notes[1].startTime).toBeCloseTo(0, 3);
    });

    it("gives correct durations per voice", () => {
      const { notes } = parseMusicXml(SAMPLE_TWO_VOICES_XML);
      const c4 = notes.find((n) => n.pitch === "C4");
      const e5 = notes.find((n) => n.pitch === "E5");
      expect(c4!.duration).toBeCloseTo(1.0, 3);
      expect(e5!.duration).toBeCloseTo(0.5, 3);
    });

    it("sorts output by startTime then midiNumber", () => {
      const { notes } = parseMusicXml(SAMPLE_TWO_VOICES_XML);
      for (let i = 1; i < notes.length; i++) {
        if (notes[i].startTime === notes[i - 1].startTime) {
          expect(notes[i].midiNumber).toBeGreaterThanOrEqual(notes[i - 1].midiNumber);
        } else {
          expect(notes[i].startTime).toBeGreaterThan(notes[i - 1].startTime);
        }
      }
    });

    it("defaults to voice 1 when no voice element present", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
      const { notes } = parseMusicXml(xml);
      expect(notes).toHaveLength(2);
      // Sequential, not simultaneous — both in default voice 1
      expect(notes[0].startTime).toBeCloseTo(0, 3);
      expect(notes[1].startTime).toBeCloseTo(0.5, 3);
    });

    it("voice 2 quarter notes interleave with voice 1 half notes", () => {
      const { notes } = parseMusicXml(SAMPLE_TWO_VOICES_XML);
      // Voice 1: C4 at 0s (half=1s), D4 at 1s (half=1s)
      // Voice 2: E5 at 0s (quarter=0.5s), F5 at 0.5s (quarter=0.5s)
      const d4 = notes.find((n) => n.pitch === "D4");
      const f5 = notes.find((n) => n.pitch === "F5");
      expect(d4!.startTime).toBeCloseTo(1.0, 3);
      // Voice 2 tracks its own time: E5 takes 0.5s, so F5 at 0.5s
      expect(f5!.startTime).toBeCloseTo(0.5, 3);
    });

    it("all notes have valid NoteEvent fields", () => {
      const { notes } = parseMusicXml(SAMPLE_TWO_VOICES_XML);
      for (const note of notes) {
        expect(note.pitch).toBeTruthy();
        expect(note.midiNumber).toBeGreaterThan(0);
        expect(note.frequency).toBeGreaterThan(0);
        expect(note.startTime).toBeGreaterThanOrEqual(0);
        expect(note.duration).toBeGreaterThan(0);
        expect(note.velocity).toBeGreaterThan(0);
        expect(note.velocity).toBeLessThanOrEqual(127);
      }
    });

    it("voice absent in measure 1 starts at correct time in measure 2", () => {
      // Voice 2 only appears in measure 2 — its notes must not be placed at t=0
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>2</beats><beat-type>4</beat-type></time></attributes>
      <direction><sound tempo="120"/></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type></note>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>1</duration><voice>2</voice><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;
      const { notes } = parseMusicXml(xml);
      // Measure 1 = 2 beats @ 120bpm = 1.0s; measure 2 starts at 1.0s
      const g5 = notes.find((n) => n.pitch === "G5");
      expect(g5).toBeDefined();
      // G5 is in measure 2, voice 2 — must NOT be placed at t=0
      expect(g5!.startTime).toBeGreaterThanOrEqual(1.0);
    });
  });

  describe("combined features", () => {
    it("dynamics apply correctly within chords", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions><key><fifths>0</fifths></key></attributes>
            <direction><sound tempo="120"/></direction>
            <direction><direction-type><dynamics><mf/></dynamics></direction-type></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
      const { notes } = parseMusicXml(xml);
      expect(notes).toHaveLength(3);
      for (const note of notes) {
        expect(note.velocity).toBe(70);
      }
    });

    it("key signature applies to chord notes", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions><key><fifths>1</fifths></key></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><chord/><pitch><step>B</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><chord/><pitch><step>F</step><octave>5</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
      const { notes } = parseMusicXml(xml);
      expect(notes).toHaveLength(3);
      expect(notes[0].pitch).toBe("G4");
      expect(notes[1].pitch).toBe("B4");
      // F -> F# from G major key signature
      expect(notes[2].pitch).toBe("F#5");
    });

    it("dynamics persist through repeats", () => {
      const xml = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions><key><fifths>0</fifths></key></attributes>
            <direction><sound tempo="120"/></direction>
            <direction><direction-type><dynamics><ff/></dynamics></direction-type></direction>
            <barline location="left"><repeat direction="forward"/></barline>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
            <barline location="right"><repeat direction="backward"/></barline>
          </measure>
        </part>
      </score-partwise>`;
      const { notes } = parseMusicXml(xml);
      expect(notes).toHaveLength(2);
      // Both passes should have ff velocity
      expect(notes[0].velocity).toBe(110);
      expect(notes[1].velocity).toBe(110);
    });
  });
});

// ─── Part Metadata Tests (Phase 1 — RED) ────────────────────────────────────
// These tests FAIL against the current implementation (which returns NoteSequence directly).
// They will pass once parseMusicXml is changed to return { notes, parts, notePartIndices }.

const SAMPLE_TWO_PART_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise>
  <part-list>
    <score-part id="P1"><part-name>Violin</part-name></score-part>
    <score-part id="P2"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
      </attributes>
      <direction><sound tempo="120"/></direction>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
      </attributes>
      <direction><sound tempo="120"/></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
</score-partwise>`;

describe("parseMusicXml — part metadata (Phase 1)", () => {
  describe("return shape", () => {
    it("returns an object with notes, parts, and notePartIndices keys", () => {
      const result = parseMusicXml(SAMPLE_MUSICXML);
      expect(result).toHaveProperty("notes");
      expect(result).toHaveProperty("parts");
      expect(result).toHaveProperty("notePartIndices");
    });

    it("notes array from single-part XML has correct length", () => {
      const { notes } = parseMusicXml(SAMPLE_MUSICXML);
      expect(notes).toHaveLength(14);
    });
  });

  describe("single-part XML — PartInfo", () => {
    it("returns parts array with one entry", () => {
      const { parts } = parseMusicXml(SAMPLE_MUSICXML);
      expect(parts).toHaveLength(1);
    });

    it("single part has partIndex 0", () => {
      const { parts } = parseMusicXml(SAMPLE_MUSICXML);
      expect(parts[0].partIndex).toBe(0);
    });

    it("single part has non-empty id and name", () => {
      const { parts } = parseMusicXml(SAMPLE_MUSICXML);
      expect(parts[0].id).toBeTruthy();
      expect(parts[0].name).toBeTruthy();
    });
  });

  describe("two-part XML — PartInfo", () => {
    it("returns two parts with correct ids", () => {
      const { parts } = parseMusicXml(SAMPLE_TWO_PART_XML);
      expect(parts).toHaveLength(2);
      expect(parts[0].id).toBe("P1");
      expect(parts[1].id).toBe("P2");
    });

    it("extracts correct part names from <part-name>", () => {
      const { parts } = parseMusicXml(SAMPLE_TWO_PART_XML);
      expect(parts[0].name).toBe("Violin");
      expect(parts[1].name).toBe("Piano");
    });

    it("assigns correct partIndex values", () => {
      const { parts } = parseMusicXml(SAMPLE_TWO_PART_XML);
      expect(parts[0].partIndex).toBe(0);
      expect(parts[1].partIndex).toBe(1);
    });
  });

  describe("notePartIndices", () => {
    it("notePartIndices length matches notes length", () => {
      const { notes, notePartIndices } = parseMusicXml(SAMPLE_TWO_PART_XML);
      expect(notePartIndices).toHaveLength(notes.length);
    });

    it("notePartIndices values are 0 or 1 for two-part XML", () => {
      const { notePartIndices } = parseMusicXml(SAMPLE_TWO_PART_XML);
      for (const idx of notePartIndices) {
        expect([0, 1]).toContain(idx);
      }
    });

    it("two-part XML with one note each has both part indices present", () => {
      const { notePartIndices } = parseMusicXml(SAMPLE_TWO_PART_XML);
      expect(notePartIndices).toContain(0);
      expect(notePartIndices).toContain(1);
    });

    it("notePartIndices for single-part XML are all 0", () => {
      const { notePartIndices } = parseMusicXml(SAMPLE_MUSICXML);
      for (const idx of notePartIndices) {
        expect(idx).toBe(0);
      }
    });
  });

  describe("fallback — no <part-list>", () => {
    it("returns synthesized part fallback when no <part-list> present", () => {
      const xmlNoParts = `<score-partwise>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><sound tempo="120"/></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
      const { parts } = parseMusicXml(xmlNoParts);
      expect(parts.length).toBeGreaterThan(0);
      expect(parts[0].id).toBeTruthy();
      expect(parts[0].name).toBeTruthy();
    });
  });

  describe("per-measure divisions changes (sticky divisions)", () => {
    // Each homr-run system emits its own <divisions>; a single part's measures
    // therefore declare different divisions mid-stream. Two notes of the same
    // notated value (quarter) must sound the same length regardless.
    const CHANGING_DIVISIONS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>V</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction><sound tempo="120"/></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><rest/><duration>3</duration><type>half</type></note>
    </measure>
    <measure number="2">
      <attributes><divisions>4</divisions></attributes>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type></note>
      <note><rest/><duration>12</duration><type>half</type></note>
    </measure>
  </part>
</score-partwise>`;

    it("gives equal real duration to same-value notes across divisions changes", () => {
      const { notes } = parseMusicXml(CHANGING_DIVISIONS_XML);
      const c4 = notes.find((n) => n.pitch === "C4")!;
      const d4 = notes.find((n) => n.pitch === "D4")!;
      expect(c4).toBeDefined();
      expect(d4).toBeDefined();
      // Both are quarter notes — equal duration despite divisions 1 vs 4.
      expect(d4.duration).toBeCloseTo(c4.duration, 5);
      // At 120 BPM a quarter = 0.5s.
      expect(c4.duration).toBeCloseTo(0.5, 5);
    });

    it("places the second measure one full bar after the first", () => {
      const { notes } = parseMusicXml(CHANGING_DIVISIONS_XML);
      const d4 = notes.find((n) => n.pitch === "D4")!;
      // Measure 1 is a full 4/4 bar = 4 beats = 2.0s at 120 BPM.
      expect(d4.startTime).toBeCloseTo(2.0, 5);
    });
  });
});
