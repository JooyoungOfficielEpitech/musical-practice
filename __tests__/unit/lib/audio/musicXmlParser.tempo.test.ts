import { parseMusicXml } from "../../../../client/lib/audio/musicXmlParser";

/** Minimal one-part score: a single quarter note, with a given tempo marking. */
function xmlWithTempo(tempo: string): string {
  return `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction><sound tempo="${tempo}"/></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><rest/><duration>3</duration></note>
    </measure>
  </part>
</score-partwise>`;
}

const quarterSec = (xml: string) => parseMusicXml(xml).notes[0].duration;

describe("parseMusicXml — tempo sanity clamp", () => {
  it("uses a sane tempo marking as-is (72 BPM → quarter = 60/72s)", () => {
    expect(quarterSec(xmlWithTempo("72"))).toBeCloseTo(60 / 72, 5);
  });

  it("distrusts an absurdly fast marking (400 BPM → default 100)", () => {
    expect(quarterSec(xmlWithTempo("400"))).toBeCloseTo(60 / 100, 5);
  });

  it("distrusts an absurdly slow marking (12 BPM → default 100)", () => {
    expect(quarterSec(xmlWithTempo("12"))).toBeCloseTo(60 / 100, 5);
  });
});
