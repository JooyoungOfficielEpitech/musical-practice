"""Tests for multi-part combination grading in pipeline.grader.

When GT files model compound staves (Co.SA, Co.TB) as single parts with
chords (e.g., "Bb3+Eb4"), but production splits them into separate voice
parts (Soprano/Alto, Tenor/Bass), the part_id parameter should accept
the "Soprano+Alto" or "Tenor+Bass" syntax to extract and merge both parts
per measure, combining their pitches by onset.
"""
import json
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from pipeline.grader import (
    grade,
    extract_notes_from_xml,
    normalize_pitch,
)


def _make_measure(n, divisions=1, notes_spec=None):
    """Helper: build XML measure. notes_spec = [(step, alter, octave, duration), ...]."""
    if notes_spec is None:
        notes_spec = []
    m = ET.Element("measure")
    m.set("number", str(n))
    if n == 1:
        attrs = ET.SubElement(m, "attributes")
        ET.SubElement(attrs, "divisions").text = str(divisions)
    for pitch_tuple, duration in notes_spec:
        note = ET.SubElement(m, "note")
        if pitch_tuple is None:
            ET.SubElement(note, "rest")
        else:
            pitch = ET.SubElement(note, "pitch")
            step, alter, octave = pitch_tuple
            ET.SubElement(pitch, "step").text = step
            if alter != 0:
                ET.SubElement(pitch, "alter").text = str(alter)
            ET.SubElement(pitch, "octave").text = str(octave)
        ET.SubElement(note, "duration").text = str(duration)
    return m


def _make_score(parts_dict):
    """Helper: build score from {part_id: [measures]}."""
    score = ET.Element("score-partwise")
    part_list = ET.SubElement(score, "part-list")
    for part_id in parts_dict.keys():
        sp = ET.SubElement(part_list, "score-part")
        sp.set("id", part_id)
        ET.SubElement(sp, "part-name").text = part_id
    for part_id, measures in parts_dict.items():
        part = ET.Element("part")
        part.set("id", part_id)
        for m in measures:
            part.append(m)
        score.append(part)
    return score


def _save_xml(score):
    """Save score to temp file, return path."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.xml', delete=False) as f:
        ET.ElementTree(score).write(f.name)
        return f.name


def _save_gt(gt_dict):
    """Save ground truth to temp file, return path."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(gt_dict, f)
        return f.name


class TestExtractNotesFromXmlPartCombination:
    """Test extract_notes_from_xml with part_id containing '+'."""

    def test_single_part_no_combination(self):
        """Standard single-part extraction should work unchanged."""
        m = _make_measure(1, 4, [((("D", 0, 5), 4))])
        score = _make_score({"P1": [m]})
        xml_path = _save_xml(score)
        try:
            notes = extract_notes_from_xml(xml_path, "P1")
            assert len(notes) == 1
            assert notes[0] == (1, 0.0, "D5", 1.0)
        finally:
            Path(xml_path).unlink()

    def test_combined_part_merges_by_onset(self):
        """part_id 'Soprano+Alto' should extract both parts and merge notes
        per measure by onset. Same onset = chord pitches combined.
        """
        # Soprano: D5 at onset 0, duration 1
        soprano = _make_measure(1, 4, [((("D", 0, 5), 4))])
        # Alto: Bb4 at onset 0, duration 1 (same onset)
        alto = _make_measure(1, 4, [((("B", -1, 4), 4))])

        score = _make_score({"Soprano": [soprano], "Alto": [alto]})
        xml_path = _save_xml(score)
        try:
            # Extract combined part
            notes = extract_notes_from_xml(xml_path, "Soprano+Alto")
            # Should have merged D5 and Bb4 as a chord
            assert len(notes) == 1
            measure_num, onset, pitch, duration = notes[0]
            assert measure_num == 1
            assert onset == 0.0
            assert duration == 1.0
            # Pitch should be combined tuple or special format
            # We expect something like "D5+Bb4" or both pitches listed
            assert "D5" in pitch and "Bb4" in pitch
        finally:
            Path(xml_path).unlink()

    def test_combined_part_different_onsets(self):
        """When Soprano and Alto have different onsets in same measure,
        they should be merged correctly by onset. If they span different
        durations, onsets after the first note will only have the voice(s)
        that have notes at that position.
        """
        # Soprano: D5 at onset 0, duration 0.5; C5 at onset 0.5, duration 0.5
        soprano = _make_measure(1, 4, [((("D", 0, 5), 2)), ((("C", 0, 5), 2))])
        # Alto: Bb4 at onset 0, duration 1 (spans both soprano notes)
        alto = _make_measure(1, 4, [((("B", -1, 4), 4))])

        score = _make_score({"Soprano": [soprano], "Alto": [alto]})
        xml_path = _save_xml(score)
        try:
            notes = extract_notes_from_xml(xml_path, "Soprano+Alto")
            # Should have 2 notes:
            # - D5 + Bb4 at onset 0 (both present)
            # - C5 at onset 0.5 (only soprano present)
            assert len(notes) == 2
            # Check first note is D5+Bb4
            assert notes[0][1] == 0.0
            assert "D5" in notes[0][2] and "Bb4" in notes[0][2]
            # Check second note is C5
            assert notes[1][1] == 0.5
            assert notes[1][2] == "C5"
        finally:
            Path(xml_path).unlink()

    def test_combined_part_with_rests(self):
        """Rests in one part shouldn't appear in the combined output,
        but the other part's notes should be preserved.
        """
        # Soprano: D5 at onset 0
        soprano = _make_measure(1, 4, [((("D", 0, 5), 4))])
        # Alto: rest at onset 0
        alto = _make_measure(1, 4, [(None, 4)])

        score = _make_score({"Soprano": [soprano], "Alto": [alto]})
        xml_path = _save_xml(score)
        try:
            notes = extract_notes_from_xml(xml_path, "Soprano+Alto")
            # Should have 1 note: D5 (no rest)
            assert len(notes) == 1
            assert notes[0][2] == "D5"
        finally:
            Path(xml_path).unlink()

    def test_combined_part_both_rests(self):
        """When both parts have rests at same onset, result should be 'rest'."""
        # Soprano: rest
        soprano = _make_measure(1, 4, [(None, 4)])
        # Alto: rest
        alto = _make_measure(1, 4, [(None, 4)])

        score = _make_score({"Soprano": [soprano], "Alto": [alto]})
        xml_path = _save_xml(score)
        try:
            notes = extract_notes_from_xml(xml_path, "Soprano+Alto")
            # Should have 1 rest
            assert len(notes) == 1
            assert notes[0][2] == "rest"
        finally:
            Path(xml_path).unlink()

    def test_combined_part_multiple_measures(self):
        """Combined part extraction should work across multiple measures."""
        # Soprano measures 1-2
        soprano_m1 = _make_measure(1, 4, [((("D", 0, 5), 4))])
        soprano_m2 = _make_measure(2, 4, [((("E", 0, 5), 4))])
        # Alto measures 1-2
        alto_m1 = _make_measure(1, 4, [((("B", -1, 4), 4))])
        alto_m2 = _make_measure(2, 4, [((("C", 0, 5), 4))])

        score = _make_score({
            "Soprano": [soprano_m1, soprano_m2],
            "Alto": [alto_m1, alto_m2],
        })
        xml_path = _save_xml(score)
        try:
            notes = extract_notes_from_xml(xml_path, "Soprano+Alto")
            # Should have 2 chord notes (one per measure)
            assert len(notes) == 2
            assert notes[0][0] == 1  # measure 1
            assert notes[1][0] == 2  # measure 2
            assert "D5" in notes[0][2] and "Bb4" in notes[0][2]
            assert "E5" in notes[1][2] and "C5" in notes[1][2]
        finally:
            Path(xml_path).unlink()


class TestGradeWithPartCombination:
    """Test grade() function with combined part_ids."""

    def test_grade_combined_part_perfect_match(self):
        """Grade a combined part against GT that expects chords."""
        # Soprano: Bb4
        soprano = _make_measure(1, 1, [((("B", -1, 4), 4))])
        # Alto: Eb5 (E with alter=-1)
        alto = _make_measure(1, 1, [((("E", -1, 5), 4))])

        score = _make_score({"Soprano": [soprano], "Alto": [alto]})
        xml_path = _save_xml(score)
        # GT expects the chord "Bb4+Eb5"
        gt_path = _save_gt({"measures": [{"n": 1, "notes": [["Bb4+Eb5", 4]]}]})
        try:
            result = grade(xml_path, gt_path, "Soprano+Alto")
            assert result["pitch_f1"] == 1.0
            assert result["rhythm_f1"] == 1.0
        finally:
            Path(xml_path).unlink()
            Path(gt_path).unlink()

    def test_grade_combined_part_missing_voice(self):
        """When one voice is missing a note that appears in the other,
        the chord should still match the combined result.
        """
        # Soprano: Bb4
        soprano = _make_measure(1, 1, [((("B", -1, 4), 4))])
        # Alto: rest
        alto = _make_measure(1, 1, [(None, 4)])

        score = _make_score({"Soprano": [soprano], "Alto": [alto]})
        xml_path = _save_xml(score)
        # GT expects just Bb4
        gt_path = _save_gt({"measures": [{"n": 1, "notes": [["Bb4", 4]]}]})
        try:
            result = grade(xml_path, gt_path, "Soprano+Alto")
            assert result["pitch_f1"] == 1.0
        finally:
            Path(xml_path).unlink()
            Path(gt_path).unlink()

    def test_grade_combined_part_wrong_pitch(self):
        """Wrong pitch in combined part should reduce F1."""
        # Soprano: D5 (wrong, should be Bb4)
        soprano = _make_measure(1, 1, [((("D", 0, 5), 4))])
        # Alto: Eb5
        alto = _make_measure(1, 1, [((("E", 0, 5), 4))])

        score = _make_score({"Soprano": [soprano], "Alto": [alto]})
        xml_path = _save_xml(score)
        gt_path = _save_gt({"measures": [{"n": 1, "notes": [["Bb4+Eb5", 4]]}]})
        try:
            result = grade(xml_path, gt_path, "Soprano+Alto")
            # D5 != Bb4, so pitch_f1 should be < 1.0
            assert result["pitch_f1"] < 1.0
        finally:
            Path(xml_path).unlink()
            Path(gt_path).unlink()

    def test_grade_combined_part_tenor_bass(self):
        """Same test with Tenor+Bass combination."""
        # Tenor: G3
        tenor = _make_measure(1, 1, [((("G", 0, 3), 4))])
        # Bass: Eb3 (E with alter=-1)
        bass = _make_measure(1, 1, [((("E", -1, 3), 4))])

        score = _make_score({"Tenor": [tenor], "Bass": [bass]})
        xml_path = _save_xml(score)
        gt_path = _save_gt({"measures": [{"n": 1, "notes": [["G3+Eb3", 4]]}]})
        try:
            result = grade(xml_path, gt_path, "Tenor+Bass")
            assert result["pitch_f1"] == 1.0
        finally:
            Path(xml_path).unlink()
            Path(gt_path).unlink()


class TestUnisonDedup:
    def test_unison_across_voices_merges_to_single_pitch(self):
        """Two voices singing the same pitch (unison duplication from
        split_voices) must merge to one pitch, not 'Bb3+Bb3' — GT models
        a unison as a single note."""
        soprano = _make_measure(1, 4, [((("B", -1, 3), 4))])
        alto = _make_measure(1, 4, [((("B", -1, 3), 4))])
        score = _make_score({"Soprano": [soprano], "Alto": [alto]})
        xml_path = _save_xml(score)
        try:
            notes = extract_notes_from_xml(xml_path, "Soprano+Alto")
            assert len(notes) == 1
            _, _, pitch, _ = notes[0]
            assert pitch == "Bb3"
        finally:
            Path(xml_path).unlink()
