"""Tests for core.staff_detector — staff line detection and system grouping."""

import numpy as np
import cv2

from core.staff_detector import (
    _to_gray,
    _binarize,
    _detect_staff_line_rows,
    _group_staff_lines,
    _group_into_staves,
    _group_staves_into_systems,
    _find_staff_start_x,
    _check_barline_connectivity,
    _select_lead_sheet_vocal_staves,
)


class TestSelectLeadSheetVocalStaves:
    """The vocal line in a piano-vocal score is the top staff sitting above the
    piano grand staff (the bottom two staves). Systems that are grand-staff only
    (e.g. a piano intro) carry no vocal."""

    def test_picks_top_staff_above_grand_staff(self):
        # sys0 = 2-staff piano intro (skip); sys1, sys2 = vocal + grand staff
        systems = [[0, 1], [2, 3, 4], [5, 6, 7]]
        assert _select_lead_sheet_vocal_staves(systems) == [(1, 2), (2, 5)]

    def test_all_three_staff_systems(self):
        systems = [[0, 1, 2], [3, 4, 5]]
        assert _select_lead_sheet_vocal_staves(systems) == [(0, 0), (1, 3)]

    def test_lone_staff_is_vocal(self):
        # a cappella system: a single staff with no accompaniment
        assert _select_lead_sheet_vocal_staves([[0]]) == [(0, 0)]

    def test_pure_piano_has_no_vocal(self):
        # every system is just a grand staff — nothing to sing
        assert _select_lead_sheet_vocal_staves([[0, 1], [2, 3]]) == []

    def test_extra_vocal_staves_pick_topmost(self):
        # 2 vocal staves above a grand staff — v1 extracts the topmost line
        assert _select_lead_sheet_vocal_staves([[0, 1, 2, 3]]) == [(0, 0)]

    def test_empty_systems(self):
        assert _select_lead_sheet_vocal_staves([]) == []


def make_synthetic_score(
    width: int = 1200,
    n_systems: int = 3,
    staves_per_system: int = 4,
    staff_line_spacing: int = 12,
    intra_system_gap: int = 50,
    inter_system_gap: int = 120,
    top_margin: int = 80,
    line_thickness: int = 2,
):
    """Create a synthetic sheet music image with known staff layout."""
    lines_per_staff = 5
    staff_height = (lines_per_staff - 1) * staff_line_spacing
    system_height = (
        staves_per_system * staff_height
        + (staves_per_system - 1) * intra_system_gap
    )
    total_height = (
        top_margin
        + n_systems * system_height
        + (n_systems - 1) * inter_system_gap
        + top_margin
    )

    img = np.full((total_height, width, 3), 255, dtype=np.uint8)
    y = top_margin
    staff_positions = []

    for sys_idx in range(n_systems):
        for staff_idx in range(staves_per_system):
            staff_top = y
            for line_num in range(lines_per_staff):
                line_y = y + line_num * staff_line_spacing
                cv2.line(img, (30, line_y), (width - 30, line_y), (0, 0, 0), line_thickness)
            staff_bottom = y + (lines_per_staff - 1) * staff_line_spacing
            staff_positions.append((sys_idx, staff_idx, staff_top, staff_bottom))
            y += staff_height + intra_system_gap
        y -= intra_system_gap
        y += inter_system_gap

    return img, staff_positions


class TestColorConversion:
    def test_to_gray_converts_bgr(self):
        img = np.zeros((10, 10, 3), dtype=np.uint8)
        gray = _to_gray(img)
        assert gray.ndim == 2

    def test_to_gray_passthrough_grayscale(self):
        img = np.zeros((10, 10), dtype=np.uint8)
        gray = _to_gray(img)
        assert gray.ndim == 2

    def test_binarize_produces_binary_image(self):
        gray = np.random.randint(0, 256, (100, 100), dtype=np.uint8)
        bw = _binarize(gray)
        assert set(np.unique(bw)).issubset({0, 255})


class TestStaffLineDetection:
    def test_detects_lines_in_synthetic_image(self):
        img, _ = make_synthetic_score(n_systems=2, staves_per_system=2)
        gray = _to_gray(img)
        bw = _binarize(gray)
        row_mask = _detect_staff_line_rows(bw)
        lines = _group_staff_lines(row_mask)
        expected = 2 * 2 * 5  # n_systems * staves * lines_per_staff
        assert len(lines) >= expected - 4, f"Expected ~{expected} lines, got {len(lines)}"

    def test_returns_empty_for_blank_image(self):
        bw = np.zeros((200, 400), dtype=np.uint8)
        row_mask = _detect_staff_line_rows(bw)
        lines = _group_staff_lines(row_mask)
        assert lines == []


class TestStaffGrouping:
    def test_groups_into_correct_stave_count(self):
        img, _ = make_synthetic_score(n_systems=2, staves_per_system=3)
        gray = _to_gray(img)
        bw = _binarize(gray)
        row_mask = _detect_staff_line_rows(bw)
        lines = _group_staff_lines(row_mask)
        staves = _group_into_staves(lines, img.shape[0])
        assert len(staves) == 6, f"Expected 6 staves, got {len(staves)}"

    def test_each_stave_has_five_lines(self):
        img, _ = make_synthetic_score(n_systems=2, staves_per_system=3)
        gray = _to_gray(img)
        bw = _binarize(gray)
        row_mask = _detect_staff_line_rows(bw)
        lines = _group_staff_lines(row_mask)
        staves = _group_into_staves(lines, img.shape[0])
        for i, staff in enumerate(staves):
            assert 4 <= len(staff) <= 6, f"Staff {i} has {len(staff)} lines"

    def test_returns_empty_for_fewer_than_5_lines(self):
        lines = [(10, 11), (20, 21), (30, 31)]
        staves = _group_into_staves(lines, 200)
        assert staves == []


class TestSystemGrouping:
    def test_groups_staves_into_correct_system_count(self):
        img, _ = make_synthetic_score(
            n_systems=3, staves_per_system=4,
            intra_system_gap=40, inter_system_gap=150,
        )
        gray = _to_gray(img)
        bw = _binarize(gray)
        row_mask = _detect_staff_line_rows(bw)
        lines = _group_staff_lines(row_mask)
        staves = _group_into_staves(lines, img.shape[0])
        systems = _group_staves_into_systems(staves, img.shape[0])
        assert len(systems) == 3, f"Expected 3 systems, got {len(systems)}"

    def test_each_system_has_correct_stave_count(self):
        img, _ = make_synthetic_score(
            n_systems=3, staves_per_system=4,
            intra_system_gap=40, inter_system_gap=150,
        )
        gray = _to_gray(img)
        bw = _binarize(gray)
        row_mask = _detect_staff_line_rows(bw)
        lines = _group_staff_lines(row_mask)
        staves = _group_into_staves(lines, img.shape[0])
        systems = _group_staves_into_systems(staves, img.shape[0])
        for i, system in enumerate(systems):
            assert len(system) == 4, f"System {i} has {len(system)} staves, expected 4"

    def test_single_stave_returns_one_system(self):
        staves = [[(10, 11), (20, 21), (30, 31), (40, 41), (50, 51)]]
        systems = _group_staves_into_systems(staves, 300)
        assert systems == [[0]]

    def test_empty_staves_returns_empty(self):
        systems = _group_staves_into_systems([], 300)
        assert systems == []


class TestStaffStartX:
    def test_finds_staff_start_in_synthetic(self):
        img, _ = make_synthetic_score(width=800, n_systems=1, staves_per_system=2)
        gray = _to_gray(img)
        bw = _binarize(gray)
        x = _find_staff_start_x(bw)
        # Lines start at x=30 in synthetic image
        assert 0 <= x <= 60


class TestBarlineConnectivity:
    def test_returns_empty_for_single_stave(self):
        stave = [[(10, 11), (20, 21), (30, 31), (40, 41), (50, 51)]]
        bw = np.zeros((200, 400), dtype=np.uint8)
        result = _check_barline_connectivity(bw, stave, 30)
        assert result == []
