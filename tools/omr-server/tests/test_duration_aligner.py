"""Tests for duration_aligner: rhythm normalization of TB measures to SA reference."""
import xml.etree.ElementTree as ET
from pipeline.duration_aligner import align_rhythm_to_reference


def _make_measures(divisions: int, note_specs: list[list[tuple]]) -> list[ET.Element]:
    """Build a list of <measure> ET.Elements.

    note_specs: list of measures, each a list of (type, dot, is_rest, is_chord) tuples.
    divisions is written into the first measure's attributes.
    """
    measures = []
    for m_idx, notes in enumerate(note_specs):
        m = ET.Element("measure")
        m.set("number", str(m_idx + 1))
        if m_idx == 0:
            attrs = ET.SubElement(m, "attributes")
            ET.SubElement(attrs, "divisions").text = str(divisions)
        for note_type, dot, is_rest, is_chord in notes:
            note = ET.SubElement(m, "note")
            if is_chord:
                ET.SubElement(note, "chord")
            if is_rest:
                ET.SubElement(note, "rest")
            else:
                pitch = ET.SubElement(note, "pitch")
                ET.SubElement(pitch, "step").text = "C"
                ET.SubElement(pitch, "octave").text = "4"
            beats = {"whole": 4.0, "half": 2.0, "quarter": 1.0,
                     "eighth": 0.5, "16th": 0.25}[note_type] * (1.5 if dot else 1.0)
            ET.SubElement(note, "duration").text = str(round(divisions * beats))
            ET.SubElement(note, "type").text = note_type
            if dot:
                ET.SubElement(note, "dot")
        measures.append(m)
    return measures


class TestAlignRhythmToReference:

    def test_rest_measure_unchanged(self):
        """Whole rest measures are left alone."""
        ref = _make_measures(2, [[("whole", False, True, False)]])
        tgt = _make_measures(4, [[("whole", False, True, False)]])
        result = align_rhythm_to_reference(ref, tgt)
        assert len(result) == 1
        note = result[0].find("note")
        assert note.find("rest") is not None
        assert note.findtext("type") == "whole"

    def test_dotted_eighth_corrected_to_dotted_quarter(self):
        """Core case: TB dotted eighth → dotted quarter, matching SA reference."""
        # SA: div=2, dotted quarter(3) + eighth(1) + half(4) = 8 = 4 beats
        ref = _make_measures(2, [[
            ("quarter", True,  False, False),   # dotted quarter, 3 units
            ("eighth",  False, False, False),   # eighth, 1 unit
            ("half",    False, False, False),   # half, 4 units
        ]])
        # TB: div=4, dotted eighth(3) + 16th(1) + half(8) = 12 = 3 beats (wrong)
        tgt = _make_measures(4, [[
            ("eighth",  True,  False, False),   # dotted eighth, 3 units
            ("16th",    False, False, False),   # 16th, 1 unit
            ("half",    False, False, False),   # half, 8 units
        ]])
        result = align_rhythm_to_reference(ref, tgt)
        notes = [n for n in result[0].findall("note") if n.find("chord") is None]
        assert len(notes) == 3
        # note 0: should become dotted quarter at div=4 → duration=6
        assert notes[0].findtext("type") == "quarter"
        assert notes[0].find("dot") is not None
        assert notes[0].findtext("duration") == "6"
        # note 1: should become eighth at div=4 → duration=2
        assert notes[1].findtext("type") == "eighth"
        assert notes[1].find("dot") is None
        assert notes[1].findtext("duration") == "2"
        # note 2: half stays → duration=8 (4*2)
        assert notes[2].findtext("type") == "half"
        assert notes[2].findtext("duration") == "8"

    def test_chord_notes_updated_to_match_main(self):
        """Chord notes get same duration/type as their main note."""
        # SA: dotted quarter
        ref = _make_measures(2, [[
            ("quarter", True, False, False),
            ("quarter", True, False, True),   # chord
        ]])
        # TB: dotted eighth (wrong)
        tgt = _make_measures(4, [[
            ("eighth", True, False, False),
            ("eighth", True, False, True),    # chord
        ]])
        result = align_rhythm_to_reference(ref, tgt)
        notes = result[0].findall("note")
        assert notes[0].findtext("type") == "quarter"
        assert notes[0].findtext("duration") == "6"
        assert notes[1].findtext("type") == "quarter"  # chord updated too
        assert notes[1].findtext("duration") == "6"

    def test_mismatched_note_count_left_unchanged(self):
        """If note counts differ, target measure is returned unchanged."""
        ref = _make_measures(2, [[
            ("quarter", False, False, False),
            ("quarter", False, False, False),
        ]])
        tgt = _make_measures(4, [[
            ("eighth", False, False, False),
        ]])
        result = align_rhythm_to_reference(ref, tgt)
        notes = [n for n in result[0].findall("note") if n.find("chord") is None]
        assert notes[0].findtext("type") == "eighth"  # unchanged

    def test_target_pitch_preserved(self):
        """Pitch of target notes is never changed."""
        ref = _make_measures(2, [[("half", False, False, False)]])
        tgt_measures = _make_measures(4, [[("quarter", False, False, False)]])
        # Set target pitch to G5
        pitch = tgt_measures[0].find(".//pitch")
        pitch.find("step").text = "G"
        pitch.find("octave").text = "5"

        result = align_rhythm_to_reference(ref, tgt_measures)
        out_pitch = result[0].find(".//pitch")
        assert out_pitch.findtext("step") == "G"
        assert out_pitch.findtext("octave") == "5"
