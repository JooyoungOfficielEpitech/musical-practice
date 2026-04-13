"""Tests for io.xml_writer — MusicXML file I/O and page merging."""

import os
import tempfile
import xml.etree.ElementTree as ET

from omr_io.xml_writer import load_part, combine_parts, merge_pages


def _write_simple_musicxml(path: str, part_name: str = "Voice", n_measures: int = 2) -> None:
    """Write a minimal MusicXML file for testing."""
    root = ET.Element("score-partwise")
    root.set("version", "3.1")
    pl = ET.SubElement(root, "part-list")
    sp = ET.SubElement(pl, "score-part")
    sp.set("id", "P1")
    ET.SubElement(sp, "part-name").text = part_name
    part = ET.SubElement(root, "part")
    part.set("id", "P1")
    for i in range(n_measures):
        m = ET.SubElement(part, "measure")
        m.set("number", str(i + 1))
        if i == 0:
            attrs = ET.SubElement(m, "attributes")
            ET.SubElement(attrs, "divisions").text = "2"
        note = ET.SubElement(m, "note")
        ET.SubElement(note, "rest")
        ET.SubElement(note, "duration").text = "8"
        ET.SubElement(note, "type").text = "whole"
    tree = ET.ElementTree(root)
    tree.write(path, encoding="unicode", xml_declaration=True)


class TestLoadPart:
    def test_returns_measures_and_divisions(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "test.musicxml")
            _write_simple_musicxml(path, n_measures=3)
            measures, divisions = load_part(path)
            assert len(measures) == 3
            assert isinstance(divisions, int)
            assert divisions > 0

    def test_divisions_parsed_from_attributes(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "test.musicxml")
            _write_simple_musicxml(path, n_measures=2)
            _, divisions = load_part(path)
            assert divisions == 2


class TestCombineParts:
    def test_single_part_produces_valid_xml(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "input.musicxml")
            out = os.path.join(tmp, "combined.musicxml")
            _write_simple_musicxml(path, n_measures=3)
            measures, divisions = load_part(path)
            combine_parts([(measures, divisions)], out)
            assert os.path.exists(out)
            root = ET.parse(out).getroot()
            assert root.tag == "score-partwise"

    def test_combined_has_correct_measure_count(self):
        with tempfile.TemporaryDirectory() as tmp:
            p1 = os.path.join(tmp, "p1.musicxml")
            out = os.path.join(tmp, "combined.musicxml")
            _write_simple_musicxml(p1, n_measures=4)
            measures, divisions = load_part(p1)
            combine_parts([(measures, divisions)], out)
            root = ET.parse(out).getroot()
            assert len(root.findall(".//measure")) == 4


class TestMergePages:
    def _make_measures(self, n: int = 2) -> list[ET.Element]:
        measures = []
        for i in range(n):
            m = ET.Element("measure")
            m.set("number", str(i + 1))
            note = ET.SubElement(m, "note")
            ET.SubElement(note, "rest")
            ET.SubElement(note, "duration").text = "8"
            measures.append(m)
        return measures

    def test_returns_valid_xml_string(self):
        result = merge_pages([self._make_measures(3)])
        root = ET.fromstring(result)
        assert root.tag == "score-partwise"

    def test_merges_measures_from_multiple_pages(self):
        result = merge_pages([self._make_measures(3), self._make_measures(2)])
        root = ET.fromstring(result)
        assert len(root.findall(".//measure")) == 5

    def test_measure_numbers_sequential(self):
        result = merge_pages([self._make_measures(3)])
        root = ET.fromstring(result)
        for i, m in enumerate(root.findall(".//measure"), 1):
            assert m.get("number") == str(i)


