"""Tests for pipeline.voice_splitter — MusicXML voice splitting."""

import xml.etree.ElementTree as ET

from pipeline.voice_splitter import split_voices


SINGLE_VOICE_XML = """\
<?xml version='1.0' encoding='utf-8'?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Soprano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note>
        <voice>1</voice>
        <pitch><step>C</step><octave>5</octave></pitch>
        <duration>4</duration><type>half</type>
      </note>
    </measure>
  </part>
</score-partwise>"""

TWO_VOICE_XML = """\
<?xml version='1.0' encoding='utf-8'?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>SATB</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note>
        <voice>1</voice>
        <pitch><step>C</step><octave>5</octave></pitch>
        <duration>4</duration><type>half</type>
      </note>
      <backup><duration>4</duration></backup>
      <note>
        <voice>2</voice>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>4</duration><type>half</type>
      </note>
    </measure>
  </part>
</score-partwise>"""


class TestSplitVoices:
    def test_single_voice_returns_one_key(self):
        result = split_voices(SINGLE_VOICE_XML)
        assert len(result) == 1
        assert "voice1" in result

    def test_two_voice_returns_two_keys(self):
        result = split_voices(TWO_VOICE_XML)
        assert len(result) == 2
        assert "voice1" in result
        assert "voice2" in result

    def test_output_is_valid_xml(self):
        result = split_voices(TWO_VOICE_XML)
        for key, xml_str in result.items():
            root = ET.fromstring(xml_str)
            assert root.tag == "score-partwise", f"{key} is not valid MusicXML"

    def test_voice1_contains_only_voice1_notes(self):
        result = split_voices(TWO_VOICE_XML)
        root = ET.fromstring(result["voice1"])
        for note in root.findall(".//note"):
            voice_el = note.find("voice")
            # After split, voice element is removed for clean output
            assert voice_el is None

    def test_voice2_gets_rest_when_absent_in_measure(self):
        # voice2 only appears in measure 1 — if we add a second measure with voice1 only,
        # voice2 should get a whole rest in that measure
        xml = """\
<?xml version='1.0' encoding='utf-8'?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Test</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><voice>1</voice><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration></note>
      <backup><duration>4</duration></backup>
      <note><voice>2</voice><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
    <measure number="2">
      <note><voice>1</voice><pitch><step>D</step><octave>5</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>"""
        result = split_voices(xml)
        root2 = ET.fromstring(result["voice2"])
        measures = root2.findall(".//measure")
        # Measure 2 should have a rest since voice2 was absent
        m2_notes = measures[1].findall("note")
        assert len(m2_notes) == 1
        assert m2_notes[0].find("rest") is not None

    def test_invalid_xml_returns_fallback(self):
        result = split_voices("not xml")
        assert "voice1" in result

    def test_no_backup_elements_in_output(self):
        result = split_voices(TWO_VOICE_XML)
        for key, xml_str in result.items():
            root = ET.fromstring(xml_str)
            assert root.find(".//backup") is None, f"{key} still has <backup>"


DEGENERATE_VOICE_XML = """\
<?xml version='1.0' encoding='utf-8'?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>SA</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><voice>1</voice><pitch><step>G</step><octave>5</octave></pitch><duration>2</duration></note>
      <note><voice>1</voice><pitch><step>G</step><octave>5</octave></pitch><duration>2</duration></note>
      <note><voice>1</voice><pitch><step>B</step><octave>4</octave></pitch><duration>2</duration></note>
      <note><chord/><voice>1</voice><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration></note>
      <note><voice>1</voice><pitch><step>B</step><octave>4</octave></pitch><duration>2</duration></note>
      <note><chord/><voice>1</voice><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration></note>
      <backup><duration>8</duration></backup>
      <note><voice>2</voice><pitch><step>F</step><octave>4</octave></pitch><duration>8</duration></note>
    </measure>
  </part>
</score-partwise>"""


def _pitched_count(xml: str) -> int:
    root = ET.fromstring(xml)
    return sum(1 for n in root.findall(".//note") if n.find("pitch") is not None)


class TestDegenerateVoiceSplit:
    """A stray voice-2 tag must not starve voice2 when chords carry the content.

    Real failure (p8 SA, scale1.5): homr tagged ONE note voice=2 and put all
    chords in voice 1; voice-number split returned a 1-note voice2 and the
    chord content never split. Expected: fall through to chord splitting.
    """

    def test_falls_back_to_chord_split(self):
        result = split_voices(DEGENERATE_VOICE_XML)
        assert set(result.keys()) == {"voice1", "voice2"}
        # voice2 must contain the chord bottoms (2× F4), not just the stray note
        assert _pitched_count(result["voice2"]) >= 2

    def test_voice1_keeps_chord_tops(self):
        result = split_voices(DEGENERATE_VOICE_XML)
        root = ET.fromstring(result["voice1"])
        pitches = {
            f"{n.findtext('pitch/step')}{n.findtext('pitch/octave')}"
            for n in root.findall(".//note") if n.find("pitch") is not None
        }
        assert "B4" in pitches  # chord top stays in voice1

    def test_no_backup_in_chord_split_output(self):
        result = split_voices(DEGENERATE_VOICE_XML)
        for xml in result.values():
            root = ET.fromstring(xml)
            assert root.find(".//backup") is None
            assert root.find(".//forward") is None
