"""Tests for core.label_ocr — OCR-based staff label detection."""

import numpy as np

from core.label_ocr import (
    _measure_label_ink,
    _assign_labels_by_position,
)


def _make_five_line_staff(top: int = 20, spacing: int = 10) -> list[tuple[int, int]]:
    """Return a synthetic 5-line staff as list of (top_row, bot_row) bands."""
    return [(top + i * spacing, top + i * spacing + 1) for i in range(5)]


class TestMeasureLabelInk:
    def test_returns_three_ints(self):
        gray = np.full((200, 400), 255, dtype=np.uint8)
        staff = _make_five_line_staff(top=50)
        dark_pixels, text_cols, text_start = _measure_label_ink(gray, staff, staff_start_x=60)
        assert isinstance(dark_pixels, int)
        assert isinstance(text_cols, int)
        assert isinstance(text_start, int)

    def test_blank_region_returns_zero_ink(self):
        gray = np.full((200, 400), 255, dtype=np.uint8)
        staff = _make_five_line_staff(top=50)
        dark_pixels, text_cols, text_start = _measure_label_ink(gray, staff, staff_start_x=60)
        assert dark_pixels == 0
        assert text_cols == 0
        assert text_start == -1

    def test_dark_region_returns_positive_ink(self):
        gray = np.full((200, 400), 255, dtype=np.uint8)
        # Draw some dark text in the label region
        gray[50:80, 5:55] = 50
        staff = _make_five_line_staff(top=50)
        dark_pixels, text_cols, text_start = _measure_label_ink(gray, staff, staff_start_x=60)
        assert dark_pixels > 0
        assert text_cols > 0


class TestAssignLabelsByPosition:
    def test_empty_system_returns_empty_dict(self):
        gray = np.full((200, 400), 255, dtype=np.uint8)
        result = _assign_labels_by_position(
            system_staff_indices=[],
            staves=[],
            gray=gray,
            character_names=["Alice"],
            staff_start_x=60,
        )
        assert result == {}

    def test_single_staff_positional_fallback(self):
        gray = np.full((200, 400), 255, dtype=np.uint8)
        staves = [_make_five_line_staff(top=50)]
        result = _assign_labels_by_position(
            system_staff_indices=[0],
            staves=staves,
            gray=gray,
            character_names=["Alice"],
            staff_start_x=60,
            ocr_engine=None,
        )
        assert result == {0: "Alice"}

    def test_multi_staff_positional_assignment(self):
        gray = np.full((300, 400), 255, dtype=np.uint8)
        staves = [
            _make_five_line_staff(top=30),
            _make_five_line_staff(top=100),
            _make_five_line_staff(top=170),
        ]
        result = _assign_labels_by_position(
            system_staff_indices=[0, 1, 2],
            staves=staves,
            gray=gray,
            character_names=["Orpheus", "Eurydice"],
            staff_start_x=60,
            ocr_engine=None,
        )
        assert result[0] == "Orpheus"
        assert result[1] == "Eurydice"
        # Staff 2 gets worker name since no character name left
        assert "W." in result[2]

    def test_no_character_names_no_ocr_returns_empty(self):
        gray = np.full((200, 400), 255, dtype=np.uint8)
        staves = [_make_five_line_staff(top=50)]
        result = _assign_labels_by_position(
            system_staff_indices=[0],
            staves=staves,
            gray=gray,
            character_names=[],
            staff_start_x=60,
            ocr_engine=None,
        )
        assert result == {}
