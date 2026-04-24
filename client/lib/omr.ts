import { File, Directory, Paths } from "expo-file-system";
import { parseMusicXml } from "./audio/musicXmlParser";
import type { NoteSequence } from "../types/music";

// Local OMR server running on Mac — replace IP if needed
const OMR_API_URL = "http://192.168.0.10:8000";

export type OmrStatus = "none" | "processing" | "ready" | "failed";

export interface OmrResult {
  musicXmlUri: string;
  noteSequenceUri: string;
  noteSequence: NoteSequence;
}

/** Directory for storing MusicXML and NoteSequence files */
function getMusicXmlDir(): Directory {
  const dir = new Directory(Paths.document, "musicxml");
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

/**
 * Read a local image file and convert to base64 string.
 */
async function readImageAsBase64(imageUri: string): Promise<string> {
  const file = new File(imageUri);
  const base64 = file.base64();
  return base64;
}

/**
 * Process a sheet music image through the OMR pipeline.
 *
 * 1. Read image from local file, convert to base64
 * 2. POST to local OMR server via ngrok
 * 3. Receive MusicXML string
 * 4. Save MusicXML to local file
 * 5. Parse MusicXML to NoteSequence
 * 6. Save NoteSequence to local file
 * 7. Return the result URIs and parsed data
 */
export async function processSheetMusicImage(
  imageUri: string,
  sheetId: string,
): Promise<OmrResult> {
  // Step 1: Read image and convert to base64
  const imageBase64 = await readImageAsBase64(imageUri);

  // Step 2: Call local OMR server via ngrok
  let musicXml: string;

  const response = await fetch(`${OMR_API_URL}/omr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageBase64 }),
  }).catch((err: Error) => {
    throw new Error(`OMR network error: ${err.message}`);
  });

  if (!response.ok) {
    throw new Error(`OMR server error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { musicxml?: string; success: boolean; error?: string };

  if (!data.success) {
    throw new Error(`OMR processing failed: ${data.error ?? "unknown error"}`);
  }

  if (!data.musicxml) {
    throw new Error("OMR returned empty result");
  }

  musicXml = data.musicxml;

  // Step 3-4: Save MusicXML to local file
  const dir = getMusicXmlDir();
  const xmlFile = new File(dir, `${sheetId}.musicxml`);
  xmlFile.write(musicXml);
  const musicXmlUri = xmlFile.uri;

  // Step 5: Parse MusicXML to NoteSequence
  const { notes: noteSequence } = parseMusicXml(musicXml);

  // Step 6: Save NoteSequence to local file
  const jsonFile = new File(dir, `${sheetId}.json`);
  jsonFile.write(JSON.stringify(noteSequence));
  const noteSequenceUri = jsonFile.uri;

  return { musicXmlUri, noteSequenceUri, noteSequence };
}

/**
 * Check OMR processing status for a sheet.
 */
export function getOmrStatus(omrStatus?: string): OmrStatus {
  if (
    omrStatus === "processing" ||
    omrStatus === "ready" ||
    omrStatus === "failed"
  ) {
    return omrStatus;
  }
  return "none";
}

/**
 * Mock MusicXML for testing when Supabase is not configured.
 */
function getMockMusicXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>OMR Result</part-name>
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
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="3">
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><type>half</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
    </measure>
    <measure number="4">
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
    </measure>
  </part>
</score-partwise>`;
}
