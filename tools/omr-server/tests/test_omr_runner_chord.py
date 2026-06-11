"""Tests for run_chord_strategy — chord-recall-optimised strategy selection."""

import xml.etree.ElementTree as ET
from unittest.mock import patch

import numpy as np
import pytest

from pipeline.omr_runner import CHORD_STRATEGY_NAMES, run_chord_strategy, score_musicxml
from pipeline.strategies import preprocess_scale15


def _xml(n_singles: int, n_chord_notes: int) -> str:
    """MusicXML with N single notes and a chord carrying M extra chord notes."""
    root = ET.Element("score-partwise")
    part = ET.SubElement(root, "part", {"id": "P1"})
    measure = ET.SubElement(part, "measure", {"number": "1"})
    for i in range(n_singles):
        note = ET.SubElement(measure, "note")
        pitch = ET.SubElement(note, "pitch")
        ET.SubElement(pitch, "step").text = "C"
        ET.SubElement(pitch, "octave").text = str(4 + i % 3)
        ET.SubElement(note, "duration").text = "2"
    for _ in range(n_chord_notes):
        note = ET.SubElement(measure, "note")
        ET.SubElement(note, "chord")
        pitch = ET.SubElement(note, "pitch")
        ET.SubElement(pitch, "step").text = "E"
        ET.SubElement(pitch, "octave").text = "4"
        ET.SubElement(note, "duration").text = "2"
    return ET.tostring(root, encoding="unicode")


IMG = np.full((60, 200), 255, dtype=np.uint8)


class TestScoreMusicxmlChordDetails:
    def test_details_include_chord_notes(self):
        _, details = score_musicxml(_xml(3, 2))
        assert details["chord_notes"] == 2

    def test_no_chords_is_zero(self):
        _, details = score_musicxml(_xml(3, 0))
        assert details["chord_notes"] == 0


class TestRunChordStrategy:
    def test_picks_most_chord_notes_even_with_lower_score(self):
        # original: many singles (high generic score), no chords
        # adaptive: fewer notes but 3 chord notes  → must win
        # sharpen: 1 chord note
        with patch(
            "pipeline.omr_runner.run_homr",
            side_effect=[_xml(8, 0), _xml(4, 3), _xml(4, 1), _xml(5, 0)],
        ):
            xml, score, strategy = run_chord_strategy(IMG)
        assert strategy == "adaptive"
        assert "chord" in xml

    def test_chord_tie_broken_by_pitched_notes(self):
        with patch(
            "pipeline.omr_runner.run_homr",
            side_effect=[_xml(2, 2), _xml(6, 2), _xml(3, 2), _xml(1, 2)],
        ):
            _, _, strategy = run_chord_strategy(IMG)
        assert strategy == "adaptive"  # same chords, most pitched

    def test_failed_strategies_skipped(self):
        with patch(
            "pipeline.omr_runner.run_homr",
            side_effect=[None, None, _xml(3, 1), None],
        ):
            xml, _, strategy = run_chord_strategy(IMG)
        assert strategy == "sharpen"

    def test_all_failed_raises(self):
        with patch("pipeline.omr_runner.run_homr", side_effect=[None, None, None, None]):
            with pytest.raises(RuntimeError):
                run_chord_strategy(IMG)

    def test_result_is_postprocessed(self):
        with patch(
            "pipeline.omr_runner.run_homr",
            side_effect=[_xml(3, 1), None, None, None],
        ), patch(
            "pipeline.omr_runner.postprocess_musicxml",
            return_value="POSTPROCESSED",
        ) as post_mock:
            xml, _, _ = run_chord_strategy(IMG)
        post_mock.assert_called_once()
        assert xml == "POSTPROCESSED"


class TestScale15Strategy:
    def test_in_chord_strategy_set(self):
        assert "scale1.5" in CHORD_STRATEGY_NAMES
        assert len(CHORD_STRATEGY_NAMES) == 4

    def test_upscales_by_1_5(self):
        img = np.full((100, 200, 3), 255, dtype=np.uint8)
        out = preprocess_scale15(img)
        assert out.shape == (150, 300)

    def test_grayscale_input_supported(self):
        img = np.full((60, 80), 255, dtype=np.uint8)
        out = preprocess_scale15(img)
        assert out.shape == (90, 120)


class TestHomrExecutableResolution:
    def test_resolves_venv_homr_when_not_on_path(self, monkeypatch):
        """Server runs as ./venv/bin/python main.py without venv on PATH —
        run_homr must find the homr CLI next to the interpreter."""
        import sys
        from pathlib import Path
        from pipeline.omr_runner import _homr_executable

        monkeypatch.setattr("shutil.which", lambda name: None)
        expected = str(Path(sys.executable).parent / "homr")
        assert _homr_executable() == expected

    def test_prefers_path_homr_when_available(self, monkeypatch):
        from pipeline.omr_runner import _homr_executable

        monkeypatch.setattr("shutil.which", lambda name: "/usr/local/bin/homr")
        assert _homr_executable() == "/usr/local/bin/homr"
