"""Tests for OMR accuracy grader: pitch and rhythm F1 scoring."""
import json
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from pipeline.grader import grade, extract_notes_from_xml, normalize_pitch


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


class TestNormalizePitch:
    def test_natural_pitch(self):
        assert normalize_pitch("C", 0, 4) == "C4"

    def test_sharp_pitch(self):
        assert normalize_pitch("C", 1, 4) == "C#4"

    def test_flat_pitch(self):
        assert normalize_pitch("B", -1, 4) == "Bb4"

    def test_enharmonic_equivalence(self):
        """Bb and A# are enharmonically equivalent."""
        bb = normalize_pitch("B", -1, 4)
        a_sharp = normalize_pitch("A", 1, 4)
        assert bb == "Bb4" and a_sharp == "A#4"

    def test_double_sharp(self):
        assert normalize_pitch("A", 2, 4) == "A##4"

    def test_double_flat(self):
        assert normalize_pitch("D", -2, 4) == "Dbb4"


class TestExtractNotesFromXml:
    def test_single_note(self):
        m = _make_measure(1, 4, [((("D", 0, 5), 4))])
        score = _make_score({"P1": [m]})
        xml_path = _save_xml(score)
        try:
            notes = extract_notes_from_xml(xml_path, "P1")
            assert len(notes) == 1
            assert notes[0] == (1, 0.0, "D5", 1.0)
        finally:
            Path(xml_path).unlink()

    def test_rest(self):
        m = _make_measure(1, 4, [(None, 4)])
        score = _make_score({"P1": [m]})
        xml_path = _save_xml(score)
        try:
            notes = extract_notes_from_xml(xml_path, "P1")
            assert notes[0][2] == "rest"
        finally:
            Path(xml_path).unlink()

    def test_multiple_notes(self):
        m = _make_measure(1, 4, [((("C", 0, 4), 2)), ((("D", 0, 4), 2))])
        score = _make_score({"P1": [m]})
        xml_path = _save_xml(score)
        try:
            notes = extract_notes_from_xml(xml_path, "P1")
            assert len(notes) == 2
            assert notes[0][2] == "C4" and notes[1][2] == "D4"
        finally:
            Path(xml_path).unlink()

    def test_sharp_flat_extraction(self):
        m = _make_measure(1, 4, [((("B", -1, 4), 4)), ((("A", 1, 4), 4))])
        score = _make_score({"P1": [m]})
        xml_path = _save_xml(score)
        try:
            notes = extract_notes_from_xml(xml_path, "P1")
            assert notes[0][2] == "Bb4" and notes[1][2] == "A#4"
        finally:
            Path(xml_path).unlink()


class TestGradeFunction:
    def test_perfect_match(self):
        m = _make_measure(1, 1, [((("D", 0, 5), 4))])
        score = _make_score({"P1": [m]})
        xml_path = _save_xml(score)
        gt_path = _save_gt({"measures": [{"n": 1, "notes": [["D5", 4]]}]})
        try:
            result = grade(xml_path, gt_path, "P1")
            assert result["pitch_f1"] == 1.0 and result["rhythm_f1"] == 1.0
        finally:
            Path(xml_path).unlink()
            Path(gt_path).unlink()

    def test_wrong_pitch(self):
        m = _make_measure(1, 1, [((("D", 0, 5), 4))])
        score = _make_score({"P1": [m]})
        xml_path = _save_xml(score)
        gt_path = _save_gt({"measures": [{"n": 1, "notes": [["C5", 4]]}]})
        try:
            result = grade(xml_path, gt_path, "P1")
            assert result["pitch_f1"] == 0.0 and result["rhythm_f1"] == 1.0
        finally:
            Path(xml_path).unlink()
            Path(gt_path).unlink()

    def test_wrong_duration(self):
        m = _make_measure(1, 1, [((("D", 0, 5), 2))])
        score = _make_score({"P1": [m]})
        xml_path = _save_xml(score)
        gt_path = _save_gt({"measures": [{"n": 1, "notes": [["D5", 4]]}]})
        try:
            result = grade(xml_path, gt_path, "P1")
            assert result["rhythm_f1"] < 1.0 and result["pitch_f1"] == 1.0
        finally:
            Path(xml_path).unlink()
            Path(gt_path).unlink()

    def test_missing_note_recall(self):
        m = _make_measure(1, 1, [((("D", 0, 5), 4))])
        score = _make_score({"P1": [m]})
        xml_path = _save_xml(score)
        gt_path = _save_gt({"measures": [{"n": 1, "notes": [["D5", 2], ["C5", 2]]}]})
        try:
            result = grade(xml_path, gt_path, "P1")
            assert result["pitch_f1"] < 1.0
            assert result["per_measure"][0]["ground_truth_count"] == 2
        finally:
            Path(xml_path).unlink()
            Path(gt_path).unlink()

    def test_extra_note_precision(self):
        m = _make_measure(1, 1, [((("D", 0, 5), 2)), ((("C", 0, 5), 2))])
        score = _make_score({"P1": [m]})
        xml_path = _save_xml(score)
        gt_path = _save_gt({"measures": [{"n": 1, "notes": [["D5", 4]]}]})
        try:
            result = grade(xml_path, gt_path, "P1")
            assert result["pitch_f1"] < 1.0
            assert result["per_measure"][0]["produced_count"] == 2
        finally:
            Path(xml_path).unlink()
            Path(gt_path).unlink()

    def test_enharmonic_equivalence(self):
        m = _make_measure(1, 1, [((("B", -1, 4), 4))])
        score = _make_score({"P1": [m]})
        xml_path = _save_xml(score)
        gt_path = _save_gt({"measures": [{"n": 1, "notes": [["A#4", 4]]}]})
        try:
            result = grade(xml_path, gt_path, "P1")
            assert result["pitch_f1"] == 1.0
        finally:
            Path(xml_path).unlink()
            Path(gt_path).unlink()

    def test_x_noteheads(self):
        m = _make_measure(1, 1, [(None, 4)])
        score = _make_score({"P1": [m]})
        xml_path = _save_xml(score)
        gt_path = _save_gt({"measures": [{"n": 1, "notes": [["X4", 4]]}]})
        try:
            result = grade(xml_path, gt_path, "P1")
            assert result["pitch_f1"] == 1.0
        finally:
            Path(xml_path).unlink()
            Path(gt_path).unlink()

    def test_multiple_measures(self):
        m1 = _make_measure(1, 1, [((("D", 0, 5), 4))])
        m2 = _make_measure(2, 1, [((("C", 0, 5), 4))])
        score = _make_score({"P1": [m1, m2]})
        xml_path = _save_xml(score)
        gt_path = _save_gt({"measures": [{"n": 1, "notes": [["D5", 4]]}, {"n": 2, "notes": [["C5", 4]]}]})
        try:
            result = grade(xml_path, gt_path, "P1")
            assert len(result["per_measure"]) == 2
            assert result["per_measure"][0]["measure"] == 1
        finally:
            Path(xml_path).unlink()
            Path(gt_path).unlink()

    def test_mixed_rest_notes(self):
        m = _make_measure(1, 1, [(None, 2), ((("D", 0, 5), 2))])
        score = _make_score({"P1": [m]})
        xml_path = _save_xml(score)
        gt_path = _save_gt({"measures": [{"n": 1, "notes": [["rest", 2], ["D5", 2]]}]})
        try:
            result = grade(xml_path, gt_path, "P1")
            assert result["pitch_f1"] == 1.0 and result["rhythm_f1"] == 1.0
        finally:
            Path(xml_path).unlink()
            Path(gt_path).unlink()
