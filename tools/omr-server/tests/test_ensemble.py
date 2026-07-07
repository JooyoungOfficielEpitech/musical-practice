"""Tests for the conservative homr+Audiveris measure-level ensemble.

Fixtures are real Audiveris full-page outputs for the Hadestown job PDF
(tests/fixtures/audiveris/page{1,2}.musicxml). Our-side measures are built
to mimic homr's actual defective output for the known cases.
"""

import os
import xml.etree.ElementTree as ET

import pytest

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


def _rest_measure(n):
    return _measure(n, [(None, None, 384, "whole")])


def _tenor_p1_page():
    """Mimic homr's Tenor page-1 output: div 96; m5-6 unison entrance,
    m9 misread as dotted-8th+16th+half+pad-rest (true: dotted-q, 8th, half)."""
    ms = []
    for i in range(1, 15):
        if i == 5:
            ms.append(_measure(5, [("B3", -1, 384, "whole")], divisions=96))
        elif i == 6:
            ms.append(_measure(6, [("B3", -1, 192, "half"), (None, None, 192, "half")]))
        elif i == 9:
            ms.append(_measure(9, [
                ("D4", None, 72, "eighth"),
                ("D4", None, 24, "16th"),
                ("D4", None, 192, "half"),
                (None, None, 96, "quarter"),
            ]))
        elif i == 10:
            ms.append(_measure(10, [("D4", None, 192, "half"), (None, None, 192, "half")]))
        else:
            ms.append(_measure(i, [(None, None, 384, "whole")]))
    return ms


class TestRhythmAdoption:
    def test_m9_pad_rest_rhythm_repaired(self):
        ms = _tenor_p1_page()
        changed = refine_measures_with_audiveris(ms, _aud(1))
        assert changed >= 1
        m9 = ms[8]
        durs = [int(n.findtext("duration")) for n in m9.findall("note")]
        # dotted-quarter (144) + eighth (48) + half (192) at divisions 96
        assert durs == [144, 48, 192], durs
        types = [n.findtext("type") for n in m9.findall("note")]
        assert types[0] == "quarter" and m9.findall("note")[0].find("dot") is not None
        # no pad rest left
        assert all(n.find("rest") is None for n in m9.findall("note"))

    def test_agreeing_measures_untouched(self):
        ms = _tenor_p1_page()
        before = ET.tostring(ms[4])
        refine_measures_with_audiveris(ms, _aud(1))
        assert ET.tostring(ms[4]) == before, "m5 already correct — must not change"


class TestAlterAdoption:
    def _hermes_p2_page(self):
        """Mimic homr's Hermes page-2: m19 (index 4) with the missed Ab5 flat."""
        ms = [_rest_measure(i) for i in range(1, 18)]
        ms[0] = _measure(1, [(f"F5", None, 48, "eighth")] * 5 + [
            ("E5", -1, 48, "eighth"), ("E5", -1, 48, "eighth"), ("D5", None, 48, "eighth")],
            divisions=96)
        ms[4] = _measure(5, [
            ("A5", None, 48, "eighth"),
            ("F5", None, 96, "quarter"),
            ("E5", -1, 48, "eighth"),
            ("E5", -1, 96, "quarter"),
            ("E5", -1, 48, "eighth"),
            ("D5", -1, 48, "eighth"),
        ])
        return ms

    def test_ab5_flat_adopted(self):
        ms = self._hermes_p2_page()
        changed = refine_measures_with_audiveris(ms, _aud(2))
        assert changed >= 1
        first = ms[4].findall("note")[0]
        assert first.find("pitch").findtext("alter") == "-1", "Ab5 flat must be adopted"
        # alter inserted in valid position (after step)
        tags = [c.tag for c in first.find("pitch")]
        assert tags == ["step", "alter", "octave"]

    def test_existing_alters_never_removed(self):
        ms = self._hermes_p2_page()
        refine_measures_with_audiveris(ms, _aud(2))
        eb = ms[4].findall("note")[2]
        assert eb.find("pitch").findtext("alter") == "-1"

    def test_wrong_rhythm_not_adopted_from_audiveris(self):
        """Audiveris reads m15's beamed eighths as quarters — our correct
        eighths must survive (no trailing pad rest -> rhythm gate closed)."""
        ms = self._hermes_p2_page()
        refine_measures_with_audiveris(ms, _aud(2))
        durs = [int(n.findtext("duration")) for n in ms[0].findall("note")]
        assert durs == [48] * 8


class TestGuards:
    def test_x_measures_untouched(self):
        ms = [_rest_measure(i) for i in range(1, 15)]
        ms[11] = _measure(12, [("X", None, 48, "eighth")] * 8, divisions=96)
        before = ET.tostring(ms[11])
        refine_measures_with_audiveris(ms, _aud(1))
        assert ET.tostring(ms[11]) == before

    def test_none_root_noop(self):
        ms = _tenor_p1_page()
        assert refine_measures_with_audiveris(ms, None) == 0

    def test_all_rest_page_noop(self):
        ms = [_rest_measure(i) for i in range(1, 15)]
        assert refine_measures_with_audiveris(ms, _aud(1)) == 0
