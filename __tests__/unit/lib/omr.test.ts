import { getOmrStatus, processSheetMusicImage } from "../../../client/lib/omr";
import type { OmrStatus } from "../../../client/lib/omr";

// Mock supabase as null (no Supabase configured — uses mock MusicXML fallback)
jest.mock("../../../client/lib/supabase", () => ({
  supabase: null,
}));

const MOCK_MUSICXML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>`;

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, musicxml: MOCK_MUSICXML }),
  } as unknown as Response);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("omr", () => {
  describe("getOmrStatus", () => {
    it('returns "none" for undefined', () => {
      expect(getOmrStatus(undefined)).toBe("none");
    });

    it('returns "none" for unrecognized string', () => {
      expect(getOmrStatus("unknown")).toBe("none");
    });

    it('returns "processing" for processing status', () => {
      expect(getOmrStatus("processing")).toBe("processing");
    });

    it('returns "ready" for ready status', () => {
      expect(getOmrStatus("ready")).toBe("ready");
    });

    it('returns "failed" for failed status', () => {
      expect(getOmrStatus("failed")).toBe("failed");
    });

    it('returns "none" for empty string', () => {
      expect(getOmrStatus("")).toBe("none");
    });

    it("returns valid OmrStatus type", () => {
      const validStatuses: OmrStatus[] = ["none", "processing", "ready", "failed"];
      for (const status of validStatuses) {
        expect(validStatuses).toContain(getOmrStatus(status));
      }
    });
  });

  describe("processSheetMusicImage", () => {
    it("returns a result with mock MusicXML when Supabase is not configured", async () => {
      const result = await processSheetMusicImage(
        "file:///mock/image.jpg",
        "test-sheet-1",
      );

      expect(result).toBeDefined();
      expect(result.musicXmlUri).toBeTruthy();
      expect(result.noteSequenceUri).toBeTruthy();
      expect(result.noteSequence).toBeInstanceOf(Array);
    });

    it("produces a valid NoteSequence from mock MusicXML", async () => {
      const result = await processSheetMusicImage(
        "file:///mock/image.jpg",
        "test-sheet-2",
      );

      expect(result.noteSequence.length).toBeGreaterThan(0);
      for (const note of result.noteSequence) {
        expect(note.pitch).toBeTruthy();
        expect(note.midiNumber).toBeGreaterThan(0);
        expect(note.frequency).toBeGreaterThan(0);
        expect(note.duration).toBeGreaterThan(0);
        expect(note.startTime).toBeGreaterThanOrEqual(0);
        expect(note.velocity).toBeGreaterThan(0);
      }
    });

    it("saves MusicXML file with correct sheet ID", async () => {
      const result = await processSheetMusicImage(
        "file:///mock/image.jpg",
        "my-sheet-id",
      );

      expect(result.musicXmlUri).toContain("my-sheet-id");
      expect(result.musicXmlUri).toContain(".musicxml");
    });

    it("saves NoteSequence JSON file with correct sheet ID", async () => {
      const result = await processSheetMusicImage(
        "file:///mock/image.jpg",
        "my-sheet-id",
      );

      expect(result.noteSequenceUri).toContain("my-sheet-id");
      expect(result.noteSequenceUri).toContain(".json");
    });

    it("notes are in chronological order", async () => {
      const result = await processSheetMusicImage(
        "file:///mock/image.jpg",
        "test-order",
      );

      for (let i = 1; i < result.noteSequence.length; i++) {
        expect(result.noteSequence[i].startTime).toBeGreaterThanOrEqual(
          result.noteSequence[i - 1].startTime,
        );
      }
    });
  });
});
