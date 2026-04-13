"""Tests for core.staff_cropper — vocal staff extraction (migrated from test_staff_cropper.py)."""

import logging
import numpy as np
import cv2

from core.staff_cropper import crop_vocal_staff, enhance_for_omr

logging.basicConfig(level=logging.INFO, format="%(name)s %(levelname)s %(message)s")


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


class TestCropVocalStaff:
    def test_returns_image(self):
        img, _ = make_synthetic_score(n_systems=3, staves_per_system=4)
        result = crop_vocal_staff(img)
        assert result is not None
        assert isinstance(result, np.ndarray)
        assert result.shape[0] < img.shape[0]
        assert result.shape[1] == img.shape[1]

    def test_grayscale_input(self):
        img, _ = make_synthetic_score(n_systems=2, staves_per_system=2)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        result = crop_vocal_staff(gray)
        assert result is not None
        assert result.ndim == 2

    def test_single_staff_per_system_keeps_all(self):
        img, _ = make_synthetic_score(
            n_systems=4, staves_per_system=1,
            inter_system_gap=150,
        )
        result = crop_vocal_staff(img)
        assert result is not None

    def test_too_few_lines_returns_none(self):
        img = np.full((200, 400, 3), 255, dtype=np.uint8)
        for y in [50, 60, 70]:
            cv2.line(img, (10, y), (390, y), (0, 0, 0), 2)
        result = crop_vocal_staff(img)
        assert result is None

    def test_preserves_width(self):
        img, _ = make_synthetic_score(width=1600, n_systems=2, staves_per_system=3)
        result = crop_vocal_staff(img)
        assert result is not None
        assert result.shape[1] == 1600

    def test_vocal_staff_is_topmost(self):
        img, positions = make_synthetic_score(
            n_systems=2, staves_per_system=4,
            intra_system_gap=50, inter_system_gap=150,
        )
        for sys_idx, staff_idx, top_y, bottom_y in positions:
            if staff_idx == 0:
                cv2.circle(img, (50, (top_y + bottom_y) // 2), 8, (0, 0, 255), -1)
        result = crop_vocal_staff(img)
        assert result is not None
        red_mask = (result[:, :, 0] < 50) & (result[:, :, 1] < 50) & (result[:, :, 2] > 200)
        assert np.any(red_mask), "Red vocal markers not found in cropped result"


class TestEnhanceForOmr:
    def test_returns_grayscale_from_bgr(self):
        img = np.full((200, 300, 3), 200, dtype=np.uint8)
        result = enhance_for_omr(img)
        assert result.ndim == 2
        assert result.dtype == np.uint8

    def test_grayscale_input_preserves_shape(self):
        img = np.full((200, 300), 180, dtype=np.uint8)
        result = enhance_for_omr(img)
        assert result.shape == img.shape

    def test_sharpens_blurry_image(self):
        """Laplacian variance (sharpness) increases after enhance."""
        import cv2
        base = np.zeros((200, 300), dtype=np.uint8)
        cv2.rectangle(base, (50, 50), (150, 150), 255, 2)
        blurry = cv2.GaussianBlur(base, (0, 0), 3.0)
        sharpened = enhance_for_omr(blurry)
        lap_before = cv2.Laplacian(blurry, cv2.CV_64F).var()
        lap_after = cv2.Laplacian(sharpened, cv2.CV_64F).var()
        assert lap_after > lap_before

    def test_dark_pixels_remain_dark(self):
        """Text pixels (dark on white) stay dark after enhancement."""
        img = np.full((200, 300, 3), 255, dtype=np.uint8)
        img[80:120, 80:220] = 30  # dark text region
        result = enhance_for_omr(img)
        assert result[100, 150] < 100
