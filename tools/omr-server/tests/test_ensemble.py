"""Tests for the conservative homr+Audiveris measure-level ensemble.

Fixtures are real Audiveris full-page outputs for the Hadestown job PDF
(tests/fixtures/audiveris/page{1,2}.musicxml). Our-side chunks mimic homr's
actual per-SYSTEM output for the known defect cases — the refiner is called
once per staff-system, window-matching the chunk against the Audiveris page.
"""

import os
import xml.etree.ElementTree as ET

from pipeline.ensemble import refine_measures_with_audiveris

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures", "audiveris")


def _aud(page):
    return ET.parse(os.path.join(FIXTURES, f"page{page}.musicxml")).getroot()


def _measure(number, notes, divisions=None):
    """notes = list of (pitch_or_None, alter, duration_units, typ)."""
    m = ET.Element("measure")
    m.set("number", str(number))
    if divisions:
        attrs = ET.SubElement(m, "attributes")
        ET.SubElement(attrs, "divisions").text = str(divisions)
    for pitch, alter, dur, typ in notes:
        n = ET.SubElement(m, "note")
        if pitch is None:
            ET.SubElement(n, "rest")
        elif pitch == "X":
            ET.SubElement(n, "unpitched")
        else:
            p = ET.SubElement(n, "pitch")
            ET.SubElement(p, "step").text = pitch[0]
            if alter is not None:
                ET.SubElement(p, "alter").text = str(alter)
            ET.SubElement(p, "octave").text = pitch[1]
        ET.SubElement(n, "duration").text = str(dur)
        if typ:
            ET.SubElement(n, "type").text = typ
    return m


def _rest_measure(n, div=None):
    return _measure(n, [(None, None, 384, "whole")], divisions=div)


def _tenor_sys1_chunk():
    """homr Tenor p1 sys1 (m7-11): rests around the 'Mmm' echo; m9 misread
    as dotted-8th+16th+half+pad-rest (true rhythm: dotted-q, 8th, half)."""
    return [
        _rest_measure(7, div=96),
        _rest_measure(8),
        _measure(9, [
            ("D4", None, 72, "eighth"),
            ("D4", None, 24, "16th"),
            ("D4", None, 192, "half"),
            (None, None, 96, "quarter"),
        ]),
        _measure(10, [("D4", None, 192, "half"), (None, None, 192, "half")]),
        _rest_measure(11),
    ]


class TestRhythmAdoption:
    def test_m9_pad_rest_rhythm_repaired(self):
        ms = _tenor_sys1_chunk()
        changed = refine_measures_with_audiveris(ms, _aud(1))
        assert changed >= 1
        m9 = ms[2]
        durs = [int(n.findtext("duration")) for n in m9.findall("note")]
        # dotted-quarter (144) + eighth (48) + half (192) at divisions 96
        assert durs == [144, 48, 192], durs
        assert m9.findall("note")[0].findtext("type") == "quarter"
        assert m9.findall("note")[0].find("dot") is not None
        assert all(n.find("rest") is None for n in m9.findall("note"))

    def test_agreeing_rhythm_untouched(self):
        ms = _tenor_sys1_chunk()
        before = ET.tostring(ms[3])
        refine_measures_with_audiveris(ms, _aud(1))
        assert ET.tostring(ms[3]) == before, "m10 timing already correct — must not change"

    def test_rest_only_measures_untouched(self):
        ms = _tenor_sys1_chunk()
        before = [ET.tostring(ms[i]) for i in (0, 1, 4)]
        refine_measures_with_audiveris(ms, _aud(1))
        assert [ET.tostring(ms[i]) for i in (0, 1, 4)] == before


class TestAlterAdoption:
    def _hermes_p2_sys0_chunk(self):
        """homr Hermes p2 sys0 (m15-20) incl. the missed Ab5 flat at m19."""
        return [
            _measure(15, [("F5", None, 48, "eighth")] * 5 + [
                ("E5", -1, 48, "eighth"), ("E5", -1, 48, "eighth"), ("D5", None, 48, "eighth")],
                divisions=96),
            _measure(16, [
                ("E5", -1, 48, "eighth"), ("D5", None, 48, "eighth"),
                ("B4", -1, 96, "quarter"), ("B4", -1, 96, "quarter"), (None, None, 96, "quarter")]),
            _rest_measure(17),
            _rest_measure(18),
            _measure(19, [
                ("A5", None, 48, "eighth"),
                ("F5", None, 96, "quarter"),
                ("E5", -1, 48, "eighth"),
                ("E5", -1, 96, "quarter"),
                ("E5", -1, 48, "eighth"),
                ("D5", -1, 48, "eighth"),
            ]),
            _measure(20, [
                ("E5", -1, 96, "quarter"), ("D5", -1, 48, "eighth"), ("D5", -1, 48, "eighth"),
                ("F5", None, 48, "eighth"), ("F5", None, 96, "quarter"), (None, None, 48, "eighth")]),
        ]

    def test_ab5_flat_adopted(self):
        ms = self._hermes_p2_sys0_chunk()
        changed = refine_measures_with_audiveris(ms, _aud(2))
        assert changed >= 1
        first = ms[4].findall("note")[0]
        assert first.find("pitch").findtext("alter") == "-1", "Ab5 flat must be adopted"
        tags = [c.tag for c in first.find("pitch")]
        assert tags == ["step", "alter", "octave"]

    def test_audiveris_quarters_not_adopted(self):
        """Audiveris reads these beamed eighths as quarters (invalid measure
        sums) — our correct rhythm must survive everywhere in the chunk."""
        ms = self._hermes_p2_sys0_chunk()
        refine_measures_with_audiveris(ms, _aud(2))
        assert [int(n.findtext("duration")) for n in ms[0].findall("note")] == [48] * 8
        assert [int(n.findtext("duration")) for n in ms[5].findall("note")] == [96, 48, 48, 48, 96, 48]

    def test_existing_alters_never_removed(self):
        ms = self._hermes_p2_sys0_chunk()
        refine_measures_with_audiveris(ms, _aud(2))
        assert ms[4].findall("note")[2].find("pitch").findtext("alter") == "-1"


class TestGuards:
    def test_x_measures_untouched(self):
        ms = [_rest_measure(11, div=96),
              _measure(12, [("X", None, 48, "eighth")] * 8),
              _measure(13, [("X", None, 48, "eighth")] * 8),
              _measure(14, [("X", None, 48, "eighth")] * 8)]
        before = [ET.tostring(m) for m in ms]
        refine_measures_with_audiveris(ms, _aud(1))
        assert [ET.tostring(m) for m in ms] == before

    def test_none_root_noop(self):
        assert refine_measures_with_audiveris(_tenor_sys1_chunk(), None) == 0

    def test_all_rest_chunk_noop(self):
        ms = [_rest_measure(i, div=96) for i in range(1, 6)]
        assert refine_measures_with_audiveris(ms, _aud(1)) == 0

    def test_unmatched_content_noop(self):
        # A chunk whose pitched content exists nowhere in the page -> no-op.
        ms = [_measure(1, [("G3", None, 96, "quarter")] * 4, divisions=96)]
        before = ET.tostring(ms[0])
        assert refine_measures_with_audiveris(ms, _aud(1)) == 0
        assert ET.tostring(ms[0]) == before
