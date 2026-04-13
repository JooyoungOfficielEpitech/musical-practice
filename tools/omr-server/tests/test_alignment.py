"""Tests for pipeline.alignment — stave stitching and multi-page merging."""

import os
import tempfile
import xml.etree.ElementTree as ET
import numpy as np
import pytest

from pipeline.alignment import stitch_staves, merge_character_pages


class TestStitchStaves:
    def test_single_image_returns_that_image(self):
        img = np.full((100, 200, 3), 200, dtype=np.uint8)
        result = stitch_staves([img])
        assert result.shape == img.shape

    def test_two_images_stacked_vertically(self):
        img1 = np.full((100, 200, 3), 200, dtype=np.uint8)
        img2 = np.full((80, 200, 3), 128, dtype=np.uint8)
        result = stitch_staves([img1, img2])
        # Height = 100 + separator(20) + 80
        assert result.shape[0] == 100 + 20 + 80
        assert result.shape[1] == 200

    def test_width_padded_to_max(self):
        img1 = np.full((100, 300, 3), 200, dtype=np.uint8)
        img2 = np.full((100, 200, 3), 128, dtype=np.uint8)
        result = stitch_staves([img1, img2])
        assert result.shape[1] == 300

    def test_empty_list_raises(self):
        with pytest.raises((ValueError, IndexError)):
            stitch_staves([])

    def test_grayscale_images(self):
        img1 = np.full((100, 200), 200, dtype=np.uint8)
        img2 = np.full((80, 200), 128, dtype=np.uint8)
        result = stitch_staves([img1, img2])
        assert result.ndim == 2


class TestMergeCharacterPages:
    def _make_measures(self, n: int = 2) -> list[ET.Element]:
        measures = []
        for i in range(n):
            m = ET.Element("measure")
            m.set("number", str(i + 1))
            note = ET.SubElement(m, "note")
            ET.SubElement(note, "rest")
            dur = ET.SubElement(note, "duration")
            dur.text = "8"
            measures.append(m)
        return measures

    def test_writes_valid_musicxml(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "output.musicxml")
            merge_character_pages(
                character="Eurydice",
                all_page_measures=[self._make_measures(3)],
                output_path=path,
            )
            assert os.path.exists(path)
            root = ET.parse(path).getroot()
            assert root.tag == "score-partwise"

    def test_merges_two_pages(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "output.musicxml")
            merge_character_pages(
                character="Orpheus",
                all_page_measures=[
                    self._make_measures(3),
                    self._make_measures(2),
                ],
                output_path=path,
            )
            root = ET.parse(path).getroot()
            measures = root.findall(".//measure")
            assert len(measures) == 5

    def test_measure_numbers_are_sequential(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "output.musicxml")
            merge_character_pages(
                character="Hades",
                all_page_measures=[self._make_measures(4)],
                output_path=path,
            )
            root = ET.parse(path).getroot()
            measures = root.findall(".//measure")
            for i, m in enumerate(measures, 1):
                assert m.get("number") == str(i)

    def test_part_name_matches_character(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "output.musicxml")
            merge_character_pages(
                character="Persephone",
                all_page_measures=[self._make_measures(2)],
                output_path=path,
            )
            root = ET.parse(path).getroot()
            part_name = root.findtext(".//part-name")
            assert part_name == "Persephone"
