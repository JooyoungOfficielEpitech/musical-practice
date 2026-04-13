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
