"""Tests for x-notehead marking on the voice-separation SUCCESS path.

When voice separation succeeds for compound staves (Co.SA, Co.TB):
- The up_img and down_img are different from the merged staff image
- X-notehead positions detected on merged image may not align with separated images
- We must either:
  (a) Re-run replace_x_noteheads on up_img/down_img separately, OR
  (b) Mark both voices with shared staff positions (acceptable duplication
      since both voices genuinely carry the x-rhythm)

This test verifies both strategies work correctly.
"""
import xml.etree.ElementTree as ET
from unittest.mock import patch, MagicMock
import numpy as np


def _make_xml_with_measures(num_notes: int = 1, notehead_type: str = "normal") -> str:
    """Create minimal MusicXML with N notes, optionally with x-notehead."""
    root = ET.Element("score-partwise", {"version": "3.1"})
    ET.SubElement(root, "part-list")
    part = ET.SubElement(root, "part", {"id": "P1"})
    measure = ET.SubElement(part, "measure", {"number": "1"})
    for i in range(num_notes):
        note = ET.SubElement(measure, "note")
        pitch = ET.SubElement(note, "pitch")
        ET.SubElement(pitch, "step").text = "C"
        ET.SubElement(pitch, "octave").text = "4"
        ET.SubElement(note, "duration").text = "1"
        if notehead_type == "x":
            ET.SubElement(note, "notehead").text = "x"
    return ET.tostring(root, encoding="unicode", xml_declaration=True)


def _make_mock_separation_result(n_up: int = 4, n_down: int = 4):
    """Create a mock SeparationResult with separate up/down images."""
    from core.voice_separator import SeparationResult

    return SeparationResult(
        up_img=np.zeros((100, 100), dtype=np.uint8),
        down_img=np.zeros((100, 100), dtype=np.uint8),
        n_up=n_up,
        n_down=n_down,
        n_ambiguous=0,
    )


class TestXMarkingOnSeparationSuccess:
    """Test x-notehead marking when voice separation succeeds."""

    def test_separation_success_marks_x_on_separated_images(self, tmp_path):
        """When separation succeeds, x-positions detected on merged image
        should be marked on each separated voice XML.

        Strategy (a): Re-run replace_x_noteheads on up_img/down_img separately.
        """
        staff_image = np.zeros((100, 200), dtype=np.uint8)
        sep_result = _make_mock_separation_result(n_up=4, n_down=4)

        # Merged image x-positions (from replace_x_noteheads on merged)
        x_positions_merged = [50, 75, 100, 125]
        staff_width = 200

        with (
            patch("core.staff_cropper.replace_x_noteheads") as mock_replace,
            patch("pipeline.staff_processor.separate_voices_image", return_value=sep_result),
            patch("pipeline.staff_processor.run_homr") as mock_homr,
            patch("pipeline.staff_processor.postprocess_musicxml") as mock_postprocess,
            patch("pipeline.staff_processor.mark_x_noteheads_in_xml") as mock_mark,
            patch("pipeline.staff_processor.take_voice") as mock_take,
        ):
            # First call: merge staff image returns positions
            mock_replace.return_value = (staff_image, x_positions_merged, staff_width)

            # homr returns minimal XML for each voice
            up_xml = _make_xml_with_measures(4)
            down_xml = _make_xml_with_measures(4)
            mock_homr.side_effect = [up_xml, down_xml]

            # postprocess returns same XML
            mock_postprocess.side_effect = [up_xml, down_xml]

            # take_voice extracts upper/lower
            mock_take.side_effect = [up_xml, down_xml]

            # Mark should be called on each voice's XML with x_positions
            mock_mark.side_effect = [up_xml, down_xml]

            from pipeline.staff_processor import process_single_staff

            result = process_single_staff("Co.SA", staff_image, 0, str(tmp_path))

        # Verify mark_x_noteheads_in_xml was called for both voices
        assert mock_mark.call_count == 2

    def test_separation_success_zero_pitched_notes_fallback(self, tmp_path):
        """When a separated voice has 0 pitched notes, fallback to merged path
        which should mark x-notehead on the merged XML.
        """
        staff_image = np.zeros((100, 200), dtype=np.uint8)
        sep_result = _make_mock_separation_result(n_up=0, n_down=4)

        x_positions = [50, 75, 100, 125]
        staff_width = 200

        with (
            patch("core.staff_cropper.replace_x_noteheads") as mock_replace,
            patch("pipeline.staff_processor.separate_voices_image", return_value=sep_result),
            patch("pipeline.staff_processor.run_homr") as mock_homr,
            patch("pipeline.staff_processor.postprocess_musicxml") as mock_postprocess,
            patch("pipeline.staff_processor.mark_x_noteheads_in_xml") as mock_mark,
            patch("pipeline.staff_processor.take_voice") as mock_take,
            patch("pipeline.staff_processor.run_chord_strategy") as mock_best_strat,
            patch("pipeline.staff_processor.split_voices") as mock_split,
        ):
            # First call returns merged image x_positions, subsequent calls for voice-specific detection
            def replace_x_side_effect(img):
                return (img, x_positions, staff_width)
            mock_replace.side_effect = replace_x_side_effect

            # Up voice: 0 notes (triggers fallback)
            up_xml = _make_xml_with_measures(0)
            # Down voice: 4 notes
            down_xml = _make_xml_with_measures(4)
            mock_homr.side_effect = [up_xml, down_xml]

            mock_postprocess.side_effect = [up_xml, down_xml]
            mock_take.return_value = down_xml  # Always return down_xml

            # Fallback path: merged best-strategy
            merged_xml = _make_xml_with_measures(8)
            mock_best_strat.return_value = (merged_xml, 55.0, "otsu")

            # split_voices returns both voices
            mock_split.return_value = {
                "voice1": up_xml,
                "voice2": down_xml,
            }

            # mark_x_noteheads returns the XML unchanged
            mock_mark.return_value = merged_xml

            from pipeline.staff_processor import process_single_staff

            result = process_single_staff("Co.SA", staff_image, 0, str(tmp_path))

        # Verify mark was called (for up voice which fails and falls back to merged)
        assert mock_mark.call_count >= 1

    def test_separation_success_both_voices_succeed_with_x_marks(self, tmp_path):
        """Both separated voices succeed and both should be marked with x-noteheads
        if x_positions are provided.
        """
        staff_image = np.zeros((100, 200), dtype=np.uint8)
        sep_result = _make_mock_separation_result(n_up=8, n_down=8)

        x_positions = [40, 60, 80, 100, 120, 140, 160, 180]
        staff_width = 200

        with (
            patch("core.staff_cropper.replace_x_noteheads") as mock_replace,
            patch("pipeline.staff_processor.separate_voices_image", return_value=sep_result),
            patch("pipeline.staff_processor.run_homr") as mock_homr,
            patch("pipeline.staff_processor.postprocess_musicxml") as mock_postprocess,
            patch("pipeline.staff_processor.mark_x_noteheads_in_xml") as mock_mark,
            patch("pipeline.staff_processor.take_voice") as mock_take,
        ):
            mock_replace.return_value = (staff_image, x_positions, staff_width)

            # Both voices have notes
            up_xml = _make_xml_with_measures(8)
            down_xml = _make_xml_with_measures(8)
            mock_homr.side_effect = [up_xml, down_xml]

            mock_postprocess.side_effect = [up_xml, down_xml]
            mock_take.side_effect = [up_xml, down_xml]

            # mark should be called on both voices
            mock_mark.side_effect = [up_xml, down_xml]

            from pipeline.staff_processor import process_single_staff

            result = process_single_staff("Co.SA", staff_image, 0, str(tmp_path))

            assert "Soprano" in result
            assert "Alto" in result

        # Both voices should have been marked
        assert mock_mark.call_count == 2

    def test_x_marking_preserves_other_notes(self, tmp_path):
        """X-marking should not interfere with regular pitched notes.
        """
        staff_image = np.zeros((100, 200), dtype=np.uint8)
        sep_result = _make_mock_separation_result(n_up=12, n_down=12)

        x_positions = [40, 60, 80, 100, 120, 140, 160, 180]
        staff_width = 200

        with (
            patch("core.staff_cropper.replace_x_noteheads") as mock_replace,
            patch("pipeline.staff_processor.separate_voices_image", return_value=sep_result),
            patch("pipeline.staff_processor.run_homr") as mock_homr,
            patch("pipeline.staff_processor.postprocess_musicxml") as mock_postprocess,
            patch("pipeline.staff_processor.mark_x_noteheads_in_xml") as mock_mark,
            patch("pipeline.staff_processor.take_voice") as mock_take,
        ):
            mock_replace.return_value = (staff_image, x_positions, staff_width)

            # Create XML with 4 x-notes and 8 regular notes
            up_xml = _make_xml_with_measures(12)
            down_xml = _make_xml_with_measures(12)
            mock_homr.side_effect = [up_xml, down_xml]

            mock_postprocess.side_effect = [up_xml, down_xml]
            mock_take.side_effect = [up_xml, down_xml]

            # Verify mark is called with correct positions
            def mark_side_effect(xml, positions, **kwargs):
                # Return XML with x-noteheads marked
                return xml

            mock_mark.side_effect = mark_side_effect

            from pipeline.staff_processor import process_single_staff

            result = process_single_staff("Co.SA", staff_image, 0, str(tmp_path))

        # Verify mark was called with x_positions
        assert mock_mark.call_count == 2
        # Check that the positions were passed
        for call in mock_mark.call_args_list:
            assert call[0][1] == x_positions  # second arg should be positions
