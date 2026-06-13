"""Tests for divisions_normalizer: rescale all parts to one canonical divisions.

Each per-system homr run emits its own <divisions>; concatenating systems yields
a part whose divisions changes mid-stream and differs across parts. Consumers that
read divisions once per file (the mobile app parser) then mistime every measure
whose divisions differs from the first. normalize_divisions collapses everything
to a single LCM divisions so the durations are globally consistent.
"""
import xml.etree.ElementTree as ET

from pipeline.divisions_normalizer import normalize_divisions


def _measure(number: int, divisions: int | None, durations: list[int]) -> ET.Element:
    """Build a <measure> with optional <divisions> and a list of note durations."""
    m = ET.Element("measure")
    m.set("number", str(number))
    if divisions is not None:
        attrs = ET.SubElement(m, "attributes")
        ET.SubElement(attrs, "divisions").text = str(divisions)
    for d in durations:
        note = ET.SubElement(m, "note")
        ET.SubElement(note, "pitch")
        ET.SubElement(note, "duration").text = str(d)
        ET.SubElement(note, "type").text = "quarter"
    return m


def _all_divisions(measures: list[ET.Element]) -> list[int]:
    return [int(d.text) for m in measures for d in m.findall(".//divisions")]


def _durations(measures: list[ET.Element]) -> list[int]:
    out = []
    for m in measures:
        for tag in ("note", "backup", "forward"):
            for el in m.findall(tag):
                d = el.find("duration")
                if d is not None:
                    out.append(int(d.text))
    return out


class TestNormalizeDivisions:
    def test_two_parts_different_divisions_rescaled_to_lcm(self):
        # Part A at divisions=2 (quarter=2), Part B at divisions=4 (quarter=4).
        char = {
            "A": [_measure(1, 2, [2, 2])],
            "B": [_measure(1, 4, [4, 4])],
        }
        out = normalize_divisions(char)
        # LCM(2,4) = 4 — every divisions declaration is now 4
        assert set(_all_divisions(out["A"])) == {4}
        assert set(_all_divisions(out["B"])) == {4}
        # Part A durations doubled (2 -> 4), Part B unchanged
        assert _durations(out["A"]) == [4, 4]
        assert _durations(out["B"]) == [4, 4]

    def test_divisions_change_midstream_within_part(self):
        # Measure 1 declares divisions=1; measure 2 switches to divisions=2.
        measures = [
            _measure(1, 1, [1, 1]),   # quarters at div=1
            _measure(2, 2, [2, 2]),   # quarters at div=2
        ]
        out = normalize_divisions({"A": measures})["A"]
        # LCM(1,2)=2: measure 1 durations doubled, measure 2 unchanged
        assert _durations(out) == [2, 2, 2, 2]
        # Only one divisions declaration survives, value 2, on the first measure
        decls = _all_divisions(out)
        assert decls == [2]
        assert out[0].find(".//divisions") is not None

    def test_measure_without_divisions_inherits_previous(self):
        # Measure 2 has no <divisions> — it inherits div=1 from measure 1.
        measures = [
            _measure(1, 1, [1]),
            _measure(2, None, [1]),
            _measure(3, 4, [4]),
        ]
        out = normalize_divisions({"A": measures})["A"]
        # LCM(1,4)=4: first two measures (div=1) scale x4, third (div=4) unchanged
        assert _durations(out) == [4, 4, 4]

    def test_backup_and_forward_durations_scaled(self):
        m = ET.Element("measure")
        m.set("number", "1")
        attrs = ET.SubElement(m, "attributes")
        ET.SubElement(attrs, "divisions").text = "1"
        backup = ET.SubElement(m, "backup")
        ET.SubElement(backup, "duration").text = "1"
        forward = ET.SubElement(m, "forward")
        ET.SubElement(forward, "duration").text = "1"
        # Force a larger LCM via a second part at div=3
        out = normalize_divisions({"A": [m], "B": [_measure(1, 3, [3])]})
        assert _durations(out["A"]) == [3, 3]  # backup + forward scaled x3

    def test_note_type_not_rescaled(self):
        out = normalize_divisions({"A": [_measure(1, 1, [1])], "B": [_measure(1, 2, [2])]})
        types = [t.text for m in out["A"] for t in m.findall(".//type")]
        assert types == ["quarter"]  # symbolic type untouched

    def test_already_uniform_divisions_durations_unchanged(self):
        char = {"A": [_measure(1, 2, [2, 2])], "B": [_measure(1, 2, [4])]}
        out = normalize_divisions(char)
        assert _durations(out["A"]) == [2, 2]
        assert _durations(out["B"]) == [4]
        assert set(_all_divisions(out["A"])) == {2}

    def test_input_not_mutated(self):
        original = _measure(1, 1, [1])
        char = {"A": [original], "B": [_measure(1, 2, [2])]}
        normalize_divisions(char)
        # Original element's duration is still 1 (function returned copies)
        assert original.find("note/duration").text == "1"

    def test_empty_input_returns_empty(self):
        assert normalize_divisions({}) == {}

    def test_part_with_no_divisions_uses_default(self):
        # No divisions anywhere: nothing to scale, must not crash.
        out = normalize_divisions({"A": [_measure(1, None, [4])]})
        assert _durations(out["A"]) == [4]
