"""Tests for pipeline.measure_grid — force every measure to the time-signature bar length.

The mobile-app parser (client/lib/audio/musicXmlParser.ts) schedules each <part>
independently, accumulating note durations from t=0, and never re-synchronises parts
at barlines. So if any measure of one part sums to a different number of beats than the
same measure in another part, the parts drift apart permanently (the "Hermes vs ensemble
가 어긋난다" bug). align_and_flatten already equalises measure COUNT across parts per
system; enforce_bar_grid additionally forces every measure to sum to exactly bar_beats,
which makes every part share identical cumulative beats at every barline → no drift.
"""
import os
import xml.etree.ElementTree as ET

import pytest

from pipeline.measure_grid import enforce_bar_grid

DEBUG_DIR = os.path.join(os.path.dirname(__file__), "..", "debug_integration")


# ── builders ────────────────────────────────────────────────────────────────

def _note(duration: int, *, step: str | None = "C", octave: int = 4,
          is_rest: bool = False, is_chord: bool = False, ntype: str | None = None) -> ET.Element:
    n = ET.Element("note")
    if is_chord:
        ET.SubElement(n, "chord")
    if is_rest:
        ET.SubElement(n, "rest")
    elif step is not None:
        p = ET.SubElement(n, "pitch")
        ET.SubElement(p, "step").text = step
        ET.SubElement(p, "octave").text = str(octave)
    ET.SubElement(n, "duration").text = str(duration)
    if ntype:
        ET.SubElement(n, "type").text = ntype
    return n


def _measure(number: int, notes: list[ET.Element], *, divisions: int | None = None,
             time: tuple[int, int] | None = None, full_attrs: bool = False) -> ET.Element:
    m = ET.Element("measure")
    m.set("number", str(number))
    if divisions is not None or time is not None or full_attrs:
        attrs = ET.SubElement(m, "attributes")
        if divisions is not None:
            ET.SubElement(attrs, "divisions").text = str(divisions)
        if full_attrs:
            key = ET.SubElement(attrs, "key")
            ET.SubElement(key, "fifths").text = "-2"
        if time is not None or full_attrs:
            beats, beat_type = time or (4, 4)
            t = ET.SubElement(attrs, "time")
            ET.SubElement(t, "beats").text = str(beats)
            ET.SubElement(t, "beat-type").text = str(beat_type)
        if full_attrs:
            clef = ET.SubElement(attrs, "clef")
            ET.SubElement(clef, "sign").text = "G"
            ET.SubElement(clef, "line").text = "2"
    for n in notes:
        m.append(n)
    return m


# ── assertions ──────────────────────────────────────────────────────────────

def _running_divisions(measures: list[ET.Element], default: int = 2) -> list[int]:
    cur = default
    out = []
    for m in measures:
        d = m.find(".//divisions")
        if d is not None and d.text:
            cur = int(d.text)
        out.append(cur)
    return out


def _measure_beats(measure: ET.Element, divisions: int) -> float:
    total = 0
    for n in measure.findall("note"):
        if n.find("chord") is not None:
            continue
        d = n.find("duration")
        if d is not None and d.text:
            total += int(d.text)
    return total / divisions if divisions else 0.0


def _part_beats(measures: list[ET.Element]) -> list[float]:
    divs = _running_divisions(measures)
    return [_measure_beats(m, divs[i]) for i, m in enumerate(measures)]


# ── tests ───────────────────────────────────────────────────────────────────

class TestEnforceBarGridSingleMeasure:
    def test_exact_measure_unchanged_in_beats(self):
        part = {"P": [_measure(1, [_note(2), _note(2)], divisions=1, time=(4, 4))]}  # 4 beats
        out = enforce_bar_grid(part)
        assert _part_beats(out["P"]) == [4.0]

    def test_short_measure_padded_to_bar(self):
        part = {"P": [_measure(1, [_note(2), _note(1)], divisions=1, time=(4, 4))]}  # 3 beats
        out = enforce_bar_grid(part)
        assert _part_beats(out["P"]) == [4.0]

    def test_long_measure_compressed_to_bar(self):
        part = {"P": [_measure(1, [_note(4), _note(4)], divisions=1, time=(4, 4))]}  # 8 beats
        out = enforce_bar_grid(part)
        assert _part_beats(out["P"]) == [4.0]

    def test_empty_measure_filled_to_bar(self):
        part = {"P": [_measure(1, [], divisions=1, time=(4, 4))]}
        out = enforce_bar_grid(part)
        assert _part_beats(out["P"]) == [4.0]
        # The fill must be a rest, not a phantom pitch
        assert out["P"][0].find("note/rest") is not None

    def test_chord_notes_excluded_from_span(self):
        # main quarter + chord quarter (same slot) + three more quarters = 4 beats, not 5
        notes = [_note(1), _note(1, is_chord=True, step="E"), _note(1), _note(1), _note(1)]
        part = {"P": [_measure(1, notes, divisions=1, time=(4, 4))]}
        out = enforce_bar_grid(part)
        assert _part_beats(out["P"]) == [4.0]


class TestBarLengthFromTimeSignature:
    def test_three_four_forces_three_beats(self):
        part = {"P": [_measure(1, [_note(1), _note(1)], divisions=1, time=(3, 4))]}  # 2 beats
        out = enforce_bar_grid(part)
        assert _part_beats(out["P"]) == [3.0]

    def test_six_eight_forces_three_beats(self):
        # 6/8 = 6 eighths = 3 quarter-note beats
        part = {"P": [_measure(1, [_note(1)], divisions=1, time=(6, 8))]}  # 1 beat
        out = enforce_bar_grid(part)
        assert _part_beats(out["P"]) == [3.0]

    def test_defaults_to_four_four_without_time(self):
        part = {"P": [_measure(1, [_note(1)], divisions=1)]}  # 1 beat, no time sig
        out = enforce_bar_grid(part)
        assert _part_beats(out["P"]) == [4.0]

    def test_explicit_bar_beats_overrides(self):
        part = {"P": [_measure(1, [_note(1)], divisions=1, time=(4, 4))]}
        out = enforce_bar_grid(part, bar_beats=2.0)
        assert _part_beats(out["P"]) == [2.0]


class TestCrossPartLockInvariant:
    def test_all_parts_equal_beats_after_enforcement(self):
        # Three parts, SAME measure index, wildly different beats: 4, 8 (ensemble-double), 3 (short)
        char = {
            "Herm.": [_measure(1, [_note(2), _note(2)], divisions=1, time=(4, 4))],   # 4
            "Soprano": [_measure(1, [_note(4), _note(4)], divisions=1, time=(4, 4))],  # 8
            "Bass": [_measure(1, [_note(2), _note(1)], divisions=1, time=(4, 4))],     # 3
        }
        out = enforce_bar_grid(char)
        beats = {name: _part_beats(ms)[0] for name, ms in out.items()}
        assert beats["Herm."] == beats["Soprano"] == beats["Bass"] == 4.0

    def test_multi_measure_parts_stay_locked(self):
        char = {
            "A": [
                _measure(1, [_note(2), _note(2)], divisions=1, time=(4, 4)),  # 4
                _measure(2, [_note(2), _note(1)]),                            # 3 (short)
                _measure(3, [_note(4), _note(4)]),                            # 8 (long)
            ],
            "B": [
                _measure(1, [_note(4), _note(4)], divisions=1, time=(4, 4)),  # 8
                _measure(2, [_note(2), _note(2)]),                            # 4
                _measure(3, [_note(1)]),                                       # 1 (short)
            ],
        }
        out = enforce_bar_grid(char)
        assert _part_beats(out["A"]) == _part_beats(out["B"]) == [4.0, 4.0, 4.0]

    def test_measure_count_preserved(self):
        # A long measure must be compressed, never split (splitting would desync counts).
        char = {"A": [_measure(i + 1, [_note(8)], divisions=1, time=(4, 4)) for i in range(5)]}
        out = enforce_bar_grid(char)
        assert len(out["A"]) == 5


class TestStructuralIntegrity:
    def test_first_measure_attributes_preserved(self):
        part = {"P": [
            _measure(1, [_note(8)], divisions=1, full_attrs=True),  # long, will be scaled
            _measure(2, [_note(4)]),
        ]}
        out = enforce_bar_grid(part)
        first = out["P"][0]
        attrs = first.find("attributes")
        assert attrs is not None
        # attributes must remain the FIRST child of measure 1
        assert list(first)[0].tag == "attributes"
        # key / time / clef survive intact
        assert attrs.find("key/fifths").text == "-2"
        assert attrs.find("time/beats").text == "4"
        assert attrs.find("clef/sign").text == "G"

    def test_input_not_mutated(self):
        original = _measure(1, [_note(4), _note(4)], divisions=1, time=(4, 4))
        snapshot = ET.tostring(original)
        part = {"P": [original]}
        enforce_bar_grid(part)
        assert ET.tostring(part["P"][0]) == snapshot  # same object, untouched

    def test_padding_uses_rest_not_pitch(self):
        part = {"P": [_measure(1, [_note(1)], divisions=1, time=(4, 4))]}  # 1 beat
        out = enforce_bar_grid(part)
        rests = [n for n in out["P"][0].findall("note") if n.find("rest") is not None]
        assert len(rests) >= 1


class TestRegressionDebugFiles:
    """End-to-end proof: applying the real pipeline order to captured OMR output
    drives cross-part beat mismatches to zero."""

    @pytest.mark.parametrize("fname", [
        "user_job_result.musicxml",
        "road_to_hell_full14.musicxml",
    ])
    def test_zero_cross_part_mismatch_after_fix(self, fname):
        path = os.path.join(DEBUG_DIR, fname)
        if not os.path.exists(path):
            pytest.skip(f"debug artifact not present: {fname}")

        from pipeline.divisions_normalizer import normalize_divisions

        root = ET.parse(path).getroot()
        char_measures = {
            p.get("id"): list(p.findall("measure")) for p in root.findall("part")
        }

        fixed = enforce_bar_grid(normalize_divisions(char_measures))

        per_part_beats = {name: _part_beats(ms) for name, ms in fixed.items()}
        n_measures = max(len(v) for v in per_part_beats.values())
        mismatches = 0
        for i in range(n_measures):
            vals = [b[i] for b in per_part_beats.values() if i < len(b)]
            if vals and (max(vals) - min(vals)) > 0.01:
                mismatches += 1
        assert mismatches == 0, f"{fname}: {mismatches} measures still misaligned"
