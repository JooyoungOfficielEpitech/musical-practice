"""Tests for pipeline.postprocessor — MusicXML post-processing."""

import xml.etree.ElementTree as ET

from pipeline.postprocessor import (
    fill_empty_measures,
    inject_tempo,
    make_rest_measure,
    postprocess,
    strip_repeats,
    pitch_to_midi,
    note_to_midi,
)

# ── Fixtures ────────────────────────────────────────────────────────────

SIMPLE_XML = """\
<?xml version='1.0' encoding='utf-8'?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Test</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>half</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>half</type></note>
    </measure>
  </part>
</score-partwise>"""

XML_WITH_REPEAT = """\
<?xml version='1.0' encoding='utf-8'?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Test</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
    <measure number="2">
      <barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>"""

XML_WITH_EMPTY_MEASURE = """\
<?xml version='1.0' encoding='utf-8'?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Test</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
    <measure number="2">
    </measure>
  </part>
</score-partwise>"""


# ── Tests ────────────────────────────────────────────────────────────────

class TestPitchHelpers:
    def test_pitch_to_midi_middle_c(self):
        assert pitch_to_midi("C", 4) == 60

    def test_pitch_to_midi_a4(self):
        assert pitch_to_midi("A", 4) == 69

    def test_note_to_midi_parses_pitch_element(self):
        note_xml = "<note><pitch><step>C</step><octave>4</octave></pitch></note>"
        note = ET.fromstring(note_xml)
        assert note_to_midi(note) == 60

    def test_note_to_midi_returns_none_for_rest(self):
        note_xml = "<note><rest/><duration>4</duration></note>"
        note = ET.fromstring(note_xml)
        assert note_to_midi(note) is None


class TestMakeRestMeasure:
    def test_returns_measure_element(self):
        m = make_rest_measure()
        assert m.tag == "measure"

    def test_contains_rest_note(self):
        m = make_rest_measure()
        notes = m.findall("note")
        assert len(notes) == 1
        assert notes[0].find("rest") is not None

    def test_duration_matches_divisions(self):
        m = make_rest_measure(divisions=4)
        dur = m.find(".//duration")
        assert dur is not None
        assert int(dur.text) == 16  # 4 * 4


class TestStripRepeats:
    def test_removes_repeat_barlines(self):
        root = ET.fromstring(XML_WITH_REPEAT)
        strip_repeats(root)
        repeats = root.findall(".//repeat")
        assert len(repeats) == 0

    def test_no_op_on_xml_without_repeats(self):
        root = ET.fromstring(SIMPLE_XML)
        strip_repeats(root)  # Should not raise
        measures = root.findall(".//measure")
        assert len(measures) == 2


class TestInjectTempo:
    def test_adds_sound_element(self):
        root = ET.fromstring(SIMPLE_XML)
        inject_tempo(root)
        sound = root.find(".//sound[@tempo]")
        assert sound is not None

    def test_does_not_double_inject(self):
        root = ET.fromstring(SIMPLE_XML)
        inject_tempo(root)
        inject_tempo(root)  # Second call should be no-op
        sounds = [s for s in root.iter("sound") if s.get("tempo")]
        assert len(sounds) == 1

    def test_injects_with_custom_tempo(self):
        root = ET.fromstring(SIMPLE_XML)
        inject_tempo(root, tempo=120, sound_tempo=120)
        sound = root.find(".//sound[@tempo]")
        assert sound.get("tempo") == "120"


class TestFillEmptyMeasures:
    def test_fills_empty_measure_with_rest(self):
        root = ET.fromstring(XML_WITH_EMPTY_MEASURE)
        fill_empty_measures(root)
        measures = root.findall(".//measure")
        for m in measures:
            assert len(m.findall("note")) > 0, f"Measure {m.get('number')} still empty"

    def test_does_not_modify_measures_with_notes(self):
        root = ET.fromstring(SIMPLE_XML)
        fill_empty_measures(root)
        measures = root.findall(".//measure")
        assert len(measures) == 2


class TestPostprocess:
    def test_returns_string(self):
        result = postprocess(SIMPLE_XML)
        assert isinstance(result, str)

    def test_output_is_valid_xml(self):
        result = postprocess(SIMPLE_XML)
        root = ET.fromstring(result)
        assert root.tag == "score-partwise"

    def test_invalid_xml_returns_input_unchanged(self):
        bad_xml = "not xml at all"
        result = postprocess(bad_xml)
        assert result == bad_xml

    def test_strips_repeats_and_injects_tempo(self):
        result = postprocess(XML_WITH_REPEAT)
        root = ET.fromstring(result)
        assert len(root.findall(".//repeat")) == 0
        assert root.find(".//sound[@tempo]") is not None
