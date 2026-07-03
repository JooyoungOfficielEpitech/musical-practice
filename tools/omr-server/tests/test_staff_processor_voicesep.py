"""Tests for pipeline.staff_processor — voice separation integration.

Merged-path contract: compound staves use run_chord_strategy (chord-recall-
optimised multi-strategy preprocessing); separated voice images use plain
run_homr (already-clean single-voice images).
"""

import xml.etree.ElementTree as ET
from unittest.mock import patch, MagicMock
import numpy as np


def _make_xml_with_measures(num_notes: int = 1) -> str:
    """Create minimal MusicXML with N pitched notes."""
    root = ET.Element("score-partwise", {"version": "3.1"})
    ET.SubElement(root, "part-list")
    part = ET.SubElement(root, "part", {"id": "P1"})
    measure = ET.SubElement(part, "measure", {"number": "1"})
    for i in range(num_notes):
        note = ET.SubElement(measure, "note")
        pitch = ET.SubElement(note, "pitch")
        ET.SubElement(pitch, "step").text = "C"
        ET.SubElement(pitch, "octave").text = "4"
        ET.SubElement(note, "duration").text = "4"
    return ET.tostring(root, encoding="unicode", xml_declaration=True)


def _make_mock_separation_result(n_up: int = 2, n_down: int = 2):
    """Create a mock SeparationResult."""
    from core.voice_separator import SeparationResult

    return SeparationResult(
        up_img=np.zeros((100, 100), dtype=np.uint8),
        down_img=np.zeros((100, 100), dtype=np.uint8),
        n_up=n_up,
        n_down=n_down,
        n_ambiguous=0,
    )


class TestProcessSingleStaffNonCompound:
    """Test that non-compound characters skip voice separation."""

    def test_monophonic_staff_unchanged(self, tmp_path):
        """Non-compound staff (e.g., Piano) should use existing path."""
        staff_image = np.zeros((100, 200), dtype=np.uint8)

        with (
            patch("core.staff_cropper.replace_x_noteheads", return_value=(staff_image, [])),
            patch("pipeline.staff_processor.run_homr", return_value=_make_xml_with_measures(3)),
            patch("pipeline.staff_processor.postprocess_musicxml", return_value=_make_xml_with_measures(3)),
        ):
            from pipeline.staff_processor import process_single_staff

            result = process_single_staff("Piano", staff_image, 0, str(tmp_path))

        # Non-compound should have one key with measure list
        assert "Piano" in result
        assert len(result["Piano"]) == 1  # one measure


class TestProcessSingleStaffCompoundSeparates:
    """Test that compound characters (Co.SA, Co.TB) call separate_voices_image."""

    def test_compound_sa_separation_succeeds(self, tmp_path):
        """Co.SA with successful separation should run homr on up/down images."""
        staff_image = np.zeros((100, 200), dtype=np.uint8)
        sep_result = _make_mock_separation_result(n_up=2, n_down=2)

        with (
            patch("core.staff_cropper.replace_x_noteheads", return_value=(staff_image, [])),
            patch(
                "pipeline.staff_processor.separate_voices_image",
                return_value=sep_result,
            ),
            patch(
                "pipeline.staff_processor.run_homr",
                side_effect=[
                    _make_xml_with_measures(3),  # up voice
                    _make_xml_with_measures(2),  # down voice
                ],
            ),
            patch(
                "pipeline.staff_processor.postprocess_musicxml",
                side_effect=[
                    _make_xml_with_measures(3),
                    _make_xml_with_measures(2),
                ],
            ),
        ):
            from pipeline.staff_processor import process_single_staff

            result = process_single_staff("Co.SA", staff_image, 0, str(tmp_path))

        assert "Soprano" in result
        assert "Alto" in result

    def test_compound_none_falls_back_to_best_strategy(self, tmp_path):
        """Co.SA with separation=None uses run_chord_strategy + split_voices."""
        staff_image = np.zeros((100, 200), dtype=np.uint8)
        homr_mock = MagicMock()

        with (
            patch("core.staff_cropper.replace_x_noteheads", return_value=(staff_image, [])),
            patch(
                "pipeline.staff_processor.separate_voices_image",
                return_value=None,
            ),
            patch("pipeline.staff_processor.run_homr", homr_mock),
            patch(
                "pipeline.staff_processor.run_chord_strategy",
                return_value=(_make_xml_with_measures(4), 55.0, "otsu"),
            ) as best_mock,
            patch(
                "pipeline.staff_processor.split_voices",
                return_value={
                    "voice1": _make_xml_with_measures(2),
                    "voice2": _make_xml_with_measures(2),
                },
            ),
        ):
            from pipeline.staff_processor import process_single_staff

            result = process_single_staff("Co.SA", staff_image, 0, str(tmp_path))

        assert "Soprano" in result
        assert "Alto" in result
        best_mock.assert_called_once()
        homr_mock.assert_not_called()

    def test_compound_none_best_strategy_fails(self, tmp_path):
        """If run_chord_strategy raises (all strategies failed), voices are empty."""
        staff_image = np.zeros((100, 200), dtype=np.uint8)

        with (
            patch("core.staff_cropper.replace_x_noteheads", return_value=(staff_image, [])),
            patch(
                "pipeline.staff_processor.separate_voices_image",
                return_value=None,
            ),
            patch(
                "pipeline.staff_processor.run_chord_strategy",
                side_effect=RuntimeError("All OMR strategies failed"),
            ),
        ):
            from pipeline.staff_processor import process_single_staff

            result = process_single_staff("Co.SA", staff_image, 0, str(tmp_path))

        assert result == {"Soprano": [], "Alto": []}


class TestProcessSingleStaffFallback:
    """Test per-voice fallback when separated voice yields no pitched notes."""

    def test_down_voice_empty_falls_back_to_merged(self, tmp_path):
        """If down voice has 0 notes, use merged best-strategy path for voice2."""
        staff_image = np.zeros((100, 200), dtype=np.uint8)
        sep_result = _make_mock_separation_result(n_up=3, n_down=1)

        with (
            patch("core.staff_cropper.replace_x_noteheads", return_value=(staff_image, [])),
            patch(
                "pipeline.staff_processor.separate_voices_image",
                return_value=sep_result,
            ),
            patch(
                "pipeline.staff_processor.run_homr",
                side_effect=[
                    _make_xml_with_measures(3),  # up voice: success
                    None,  # down voice: homr fails
                ],
            ),
            patch(
                "pipeline.staff_processor.postprocess_musicxml",
                return_value=_make_xml_with_measures(3),
            ),
            patch(
                "pipeline.staff_processor.run_chord_strategy",
                return_value=(_make_xml_with_measures(2), 50.0, "original"),
            ) as best_mock,
            patch(
                "pipeline.staff_processor.split_voices",
                return_value={
                    "voice1": _make_xml_with_measures(2),
                    "voice2": _make_xml_with_measures(1),
                },
            ),
        ):
            from pipeline.staff_processor import process_single_staff

            result = process_single_staff("Co.SA", staff_image, 0, str(tmp_path))

        # Soprano uses separated up voice; Alto falls back to merged voice2
        assert "Soprano" in result
        assert "Alto" in result
        assert len(result["Alto"]) == 1
        best_mock.assert_called_once()

    def test_down_voice_unparseable_xml_falls_back(self, tmp_path):
        """If down voice XML is unparseable, use merged path for voice2."""
        staff_image = np.zeros((100, 200), dtype=np.uint8)
        sep_result = _make_mock_separation_result(n_up=2, n_down=2)

        with (
            patch("core.staff_cropper.replace_x_noteheads", return_value=(staff_image, [])),
            patch(
                "pipeline.staff_processor.separate_voices_image",
                return_value=sep_result,
            ),
            patch(
                "pipeline.staff_processor.run_homr",
                side_effect=[
                    _make_xml_with_measures(2),  # up voice: ok
                    "invalid xml <broken>",  # down voice: unparseable
                ],
            ),
            patch(
                "pipeline.staff_processor.postprocess_musicxml",
                return_value=_make_xml_with_measures(2),
            ),
            patch(
                "pipeline.staff_processor.run_chord_strategy",
                return_value=(_make_xml_with_measures(2), 50.0, "original"),
            ),
            patch(
                "pipeline.staff_processor.split_voices",
                return_value={
                    "voice1": _make_xml_with_measures(2),
                    "voice2": _make_xml_with_measures(1),
                },
            ),
        ):
            from pipeline.staff_processor import process_single_staff

            result = process_single_staff("Co.TB", staff_image, 0, str(tmp_path))

        # Both voices should have results (fallback for down)
        assert "Tenor" in result
        assert "Bass" in result


class TestProcessSingleStaffCacheMergedPath:
    """Test that merged path is attempted at most once."""

    def test_both_voices_empty_run_merged_once(self, tmp_path):
        """If both separated voices fail, run merged best-strategy once."""
        staff_image = np.zeros((100, 200), dtype=np.uint8)
        sep_result = _make_mock_separation_result(n_up=1, n_down=1)

        with (
            patch("core.staff_cropper.replace_x_noteheads", return_value=(staff_image, [])),
            patch(
                "pipeline.staff_processor.separate_voices_image",
                return_value=sep_result,
            ),
            patch("pipeline.staff_processor.run_homr", side_effect=[None, None]),
            patch(
                "pipeline.staff_processor.run_chord_strategy",
                return_value=(_make_xml_with_measures(2), 50.0, "original"),
            ) as best_mock,
            patch(
                "pipeline.staff_processor.split_voices",
                return_value={
                    "voice1": _make_xml_with_measures(1),
                    "voice2": _make_xml_with_measures(1),
                },
            ),
        ):
            from pipeline.staff_processor import process_single_staff

            result = process_single_staff("Co.SA", staff_image, 0, str(tmp_path))

        best_mock.assert_called_once()
        assert len(result["Soprano"]) == 1
        assert len(result["Alto"]) == 1

    def test_merged_failure_not_retried(self, tmp_path):
        """If merged chord-strategy raises, it is NOT retried for the second voice."""
        staff_image = np.zeros((100, 200), dtype=np.uint8)
        sep_result = _make_mock_separation_result(n_up=1, n_down=1)

        with (
            patch("core.staff_cropper.replace_x_noteheads", return_value=(staff_image, [])),
            patch(
                "pipeline.staff_processor.separate_voices_image",
                return_value=sep_result,
            ),
            patch("pipeline.staff_processor.run_homr", side_effect=[None, None]),
            patch(
                "pipeline.staff_processor.run_chord_strategy",
                side_effect=RuntimeError("All OMR strategies failed"),
            ) as best_mock,
        ):
            from pipeline.staff_processor import process_single_staff

            result = process_single_staff("Co.SA", staff_image, 0, str(tmp_path))

        best_mock.assert_called_once()
        assert result == {"Soprano": [], "Alto": []}


class TestCropCleaning:
    def test_strip_outside_staff_called_before_x_replacement(self, tmp_path):
        staff_image = np.zeros((100, 200), dtype=np.uint8)
        cleaned = np.full((100, 200), 255, dtype=np.uint8)

        with (
            patch(
                "pipeline.staff_processor.strip_outside_staff",
                return_value=cleaned,
            ) as strip_mock,
            patch(
                "core.staff_cropper.replace_x_noteheads",
                return_value=(cleaned, []),
            ) as replace_mock,
            patch("pipeline.staff_processor.run_homr", return_value=_make_xml_with_measures(2)),
            patch("pipeline.staff_processor.postprocess_musicxml", return_value=_make_xml_with_measures(2)),
        ):
            from pipeline.staff_processor import process_single_staff

            process_single_staff("Piano", staff_image, 0, str(tmp_path))

        strip_mock.assert_called_once()
        # replace_x_noteheads must receive the CLEANED image
        assert replace_mock.call_args.args[0] is cleaned
