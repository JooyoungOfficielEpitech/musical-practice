"""Tests for pipeline.chord_voicer — chord reduction for separated voices."""

import xml.etree.ElementTree as ET

import pytest

from pipeline.chord_voicer import take_voice


def _make_xml(measure_body: str) -> str:
    return f"""<?xml version="1.0"?>
<score-partwise>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      {measure_body}
    </measure>
  </part>
</score-partwise>"""


def _note(step: str, octave: int, chord: bool = False) -> str:
    chord_tag = "<chord/>" if chord else ""
    return (
        f"<note>{chord_tag}<pitch><step>{step}</step><octave>{octave}</octave></pitch>"
        f"<duration>2</duration></note>"
    )


def _pitches(xml: str) -> list[str]:
    root = ET.fromstring(xml)
    return [
        f"{n.findtext('pitch/step')}{n.findtext('pitch/octave')}"
        for n in root.findall(".//note")
        if n.find("pitch") is not None
    ]


CHORD_XML = _make_xml(_note("C", 4) + _note("E", 4, chord=True) + _note("G", 4, chord=True))


class TestTakeVoice:
    def test_upper_keeps_top_note(self):
        assert _pitches(take_voice(CHORD_XML, "upper")) == ["G4"]

    def test_lower_keeps_bottom_note(self):
        assert _pitches(take_voice(CHORD_XML, "lower")) == ["C4"]

    def test_single_notes_unchanged(self):
        xml = _make_xml(_note("D", 5) + _note("F", 4))
        assert _pitches(take_voice(xml, "upper")) == ["D5", "F4"]
        assert _pitches(take_voice(xml, "lower")) == ["D5", "F4"]

    def test_rests_unchanged(self):
        xml = _make_xml("<note><rest/><duration>8</duration></note>")
        result = take_voice(xml, "upper")
        root = ET.fromstring(result)
        assert len(root.findall(".//note/rest")) == 1

    def test_mixed_chords_and_singles(self):
        xml = _make_xml(
            _note("A", 4)
            + _note("C", 4) + _note("F", 4, chord=True)
            + _note("B", 4)
        )
        assert _pitches(take_voice(xml, "upper")) == ["A4", "F4", "B4"]
        assert _pitches(take_voice(xml, "lower")) == ["A4", "C4", "B4"]

    def test_chord_tag_removed_from_kept_note(self):
        result = take_voice(CHORD_XML, "upper")
        root = ET.fromstring(result)
        assert all(n.find("chord") is None for n in root.findall(".//note"))

    def test_invalid_xml_returned_unchanged(self):
        assert take_voice("not xml", "upper") == "not xml"

    def test_invalid_which_raises(self):
        with pytest.raises(ValueError):
            take_voice(CHORD_XML, "top")

    def test_input_not_mutated(self):
        before = CHORD_XML
        take_voice(CHORD_XML, "upper")
        assert CHORD_XML == before
