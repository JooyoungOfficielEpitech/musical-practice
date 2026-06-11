/** Verify the OMR server's full-14-page output parses through the app's MusicXML parser. */
import * as fs from "fs";
import * as path from "path";
import { parseMusicXml } from "../client/lib/audio/musicXmlParser";

const XML_PATH = path.join(
  __dirname, "..", "tools", "omr-server", "debug_integration", "road_to_hell_full14.musicxml"
);

const maybe = fs.existsSync(XML_PATH) ? describe : describe.skip;

maybe("full 14-page OMR output", () => {
  const xml = fs.readFileSync(XML_PATH, "utf-8");
  const result = parseMusicXml(xml);

  it("extracts all 6 parts with names", () => {
    expect(result.parts.map((p: any) => p.name).sort()).toEqual(
      ["Alto", "Bass", "Herm.", "Orph.", "Soprano", "Tenor"]
    );
  });

  it("produces notes with part indices aligned", () => {
    expect(result.notes.length).toBeGreaterThan(500);
    expect(result.notePartIndices.length).toBe(result.notes.length);
  });

  it("every part contributes notes", () => {
    const counts = new Map<number, number>();
    for (const idx of result.notePartIndices) counts.set(idx, (counts.get(idx) ?? 0) + 1);
    expect(counts.size).toBe(6);
    for (const [, c] of counts) expect(c).toBeGreaterThan(0);
  });

  it("filtering to one part yields a coherent subset (Alto)", () => {
    const altoIdx = result.parts.findIndex((p: any) => p.name === "Alto");
    const altoNotes = result.notes.filter((_: any, i: number) => result.notePartIndices[i] === altoIdx);
    expect(altoNotes.length).toBeGreaterThan(0);
    // Alto register sits below soprano's
    const sopIdx = result.parts.findIndex((p: any) => p.name === "Soprano");
    const sopNotes = result.notes.filter((_: any, i: number) => result.notePartIndices[i] === sopIdx);
    const mean = (ns: any[]) => ns.reduce((s: number, n: any) => s + n.midiNumber, 0) / ns.length;
    expect(mean(altoNotes)).toBeLessThan(mean(sopNotes));
  });
});
