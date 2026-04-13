import type { NoteSequence } from "../../types/music";

const VALID_STEPS = new Set(["A", "B", "C", "D", "E", "F", "G"]);
const PITCH_RE = /^([A-G])(#?)(\d+)$/;
const NOTE_BLOCK_RE = /<note\b[^>]*>[\s\S]*?<\/note>/g;
const DIVISIONS_RE = /<divisions>(\d+)<\/divisions>/;
const TEMPO_RE = /<sound[^>]*tempo="([\d.]+)"/;
const TAG_RE = (tag: string) =>
  new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`);

export function parsePitchString(
  pitch: string,
): { step: string; alter: number; octave: number } | null {
  const m = pitch.match(PITCH_RE);
  if (!m) return null;
  const [, step, sharp, octStr] = m;
  if (!VALID_STEPS.has(step)) return null;
  return { step, alter: sharp === "#" ? 1 : 0, octave: parseInt(octStr, 10) };
}

export function formatPitchString(
  step: string,
  alter: number,
  octave: number,
): string {
  return `${step}${alter === 1 ? "#" : ""}${octave}`;
}

function getTagContent(xml: string, tag: string): string | null {
  const m = xml.match(TAG_RE(tag));
  return m ? m[1].trim() : null;
}

function parseDivisionsAndTempo(xmlString: string): {
  divisions: number;
  secondsPerDivision: number;
} {
  const divMatch = xmlString.match(DIVISIONS_RE);
  const divisions = divMatch ? parseInt(divMatch[1], 10) : 1;
  const tempoMatch = xmlString.match(TEMPO_RE);
  const tempo = tempoMatch ? parseFloat(tempoMatch[1]) : 120;
  const secondsPerDivision = 60 / tempo / divisions;
  return { divisions, secondsPerDivision };
}

export function findNoteRange(
  xmlString: string,
  targetStep: string,
  targetOctave: number,
  targetStartTimeSecs: number,
  toleranceSecs = 0.05,
): { start: number; end: number } | null {
  if (!VALID_STEPS.has(targetStep)) return null;

  const { secondsPerDivision } = parseDivisionsAndTempo(xmlString);
  const voiceDivisions = new Map<string, number>();
  let lastNonChordDivision = new Map<string, number>();

  NOTE_BLOCK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = NOTE_BLOCK_RE.exec(xmlString)) !== null) {
    const noteXml = match[0];
    const start = match.index;
    const end = start + noteXml.length;

    const isRest = noteXml.includes("<rest");
    const isChord = noteXml.includes("<chord");
    const voice = getTagContent(noteXml, "voice") ?? "1";
    const durationStr = getTagContent(noteXml, "duration");
    const duration = durationStr ? parseInt(durationStr, 10) : 1;

    const currentDiv = voiceDivisions.get(voice) ?? 0;

    const startDiv = isChord
      ? (lastNonChordDivision.get(voice) ?? currentDiv)
      : currentDiv;

    if (!isChord) {
      lastNonChordDivision.set(voice, currentDiv);
      voiceDivisions.set(voice, currentDiv + duration);
    }

    if (isRest) continue;

    const step = getTagContent(noteXml, "step");
    const octStr = getTagContent(noteXml, "octave");
    if (!step || !octStr) continue;

    const octave = parseInt(octStr, 10);
    const startTimeSecs = startDiv * secondsPerDivision;

    if (
      step === targetStep &&
      octave === targetOctave &&
      Math.abs(startTimeSecs - targetStartTimeSecs) <= toleranceSecs
    ) {
      return { start, end };
    }
  }

  return null;
}

function buildPitchBlock(step: string, alter: number, octave: number): string {
  const alterTag = alter !== 0 ? `<alter>${alter}</alter>` : "";
  return `<pitch><step>${step}</step>${alterTag}<octave>${octave}</octave></pitch>`;
}

export function replaceNotePitch(
  xmlString: string,
  noteSequence: NoteSequence,
  noteIndex: number,
  newStep: string,
  newAlter: number,
  newOctave: number,
): string {
  if (noteIndex < 0 || noteIndex >= noteSequence.length) return xmlString;

  const note = noteSequence[noteIndex];
  const parsed = parsePitchString(note.pitch);
  if (!parsed) return xmlString;

  const range = findNoteRange(
    xmlString,
    parsed.step,
    parsed.octave,
    note.startTime,
  );
  if (!range) return xmlString;

  const noteBlock = xmlString.slice(range.start, range.end);
  const newPitchBlock = buildPitchBlock(newStep, newAlter, newOctave);
  const updatedNote = noteBlock.replace(
    /<pitch>[\s\S]*?<\/pitch>/,
    newPitchBlock,
  );

  return (
    xmlString.slice(0, range.start) + updatedNote + xmlString.slice(range.end)
  );
}
