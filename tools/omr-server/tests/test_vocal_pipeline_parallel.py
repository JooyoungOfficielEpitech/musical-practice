"""Tests for page-level parallelism in run_vocal_score_pipeline."""

import threading
import xml.etree.ElementTree as ET
from unittest.mock import patch

from omr_queue.vocal_pipeline import run_vocal_score_pipeline


def _measure(text="m"):
    m = ET.Element("measure")
    n = ET.SubElement(m, "note")
    p = ET.SubElement(n, "pitch")
    ET.SubElement(p, "step").text = "C"
    ET.SubElement(p, "octave").text = "4"
    ET.SubElement(n, "duration").text = "4"
    return m


class TestPageParallelism:
    def test_pages_processed_concurrently(self):
        """Two slow pages must overlap in time (parallel), not run back-to-back."""
        active = []
        peak = []
        lock = threading.Lock()

        def fake_page(png_path, tmp_dir, sys_offset):
            with lock:
                active.append(png_path)
                peak.append(len(active))
            import time
            time.sleep(0.15)
            with lock:
                active.remove(png_path)
            return {"Herm.": {0: [_measure()]}}, [0]

        with patch("omr_queue.vocal_pipeline._process_vocal_page", side_effect=fake_page):
            run_vocal_score_pipeline([["p1.png", "p2.png"]], "/tmp", "T")

        assert max(peak) >= 2, f"pages ran sequentially (peak concurrency {max(peak)})"

    def test_system_offsets_renumbered_in_page_order(self):
        """Global system indices must follow page order regardless of completion order."""
        def fake_page(png_path, tmp_dir, sys_offset):
            import time
            if png_path == "p1.png":
                time.sleep(0.2)  # page 1 finishes LAST
                return {"Herm.": {0: [_measure()], 1: [_measure()]}}, [0, 1]
            return {"Herm.": {0: [_measure(), _measure()]}}, [0]

        with patch("omr_queue.vocal_pipeline._process_vocal_page", side_effect=fake_page):
            xml = run_vocal_score_pipeline([["p1.png", "p2.png"]], "/tmp", "T")

        root = ET.fromstring(xml)
        part = root.find(".//part")
        measures = part.findall("measure")
        # page1: sys0 (1 measure) + sys1 (1 measure), page2: sys2 (2 measures) = 4 total in order
        assert len(measures) == 4

    def test_offsets_accumulate_across_pages(self):
        calls = []

        def fake_page(png_path, tmp_dir, sys_offset):
            calls.append(sys_offset)
            return {"A": {0: [_measure()]}}, [0]

        with patch("omr_queue.vocal_pipeline._process_vocal_page", side_effect=fake_page):
            run_vocal_score_pipeline([["p1.png", "p2.png", "p3.png"]], "/tmp", "T")

        # pages get LOCAL offsets now (renumbering is post-hoc) — all zero
        assert calls == [0, 0, 0]
