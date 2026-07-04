"""X-notehead replacement must scale with staff spacing (DPI-independent).

Production renders PDFs at 300 DPI (staff spacing ~17px) while the reference
fixtures are ~200 DPI (spacing ~12px). The replacement notehead was previously
a fixed 6x4px ellipse: at 300 DPI it left the original x-strokes visible, homr
found zero noteheads on x-only systems, and the whole staff came back empty.

The contract tested here: after replace_x_noteheads, re-running detection on
the output must find nothing — the drawn round heads fully cover the x-shapes
at every DPI we process.
"""

import os

import cv2
import pytest

from core.staff_cropper import replace_x_noteheads

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures", "xhead_calibration")

REF_DPI_CROP = os.path.join(FIXTURES, "page01_char_CoTB_sys2_crop.png")
PROD_DPI_CROP = os.path.join(FIXTURES, "page01_char_CoTB_sys2_crop_300dpi.png")


def _replace_then_redetect(path: str) -> tuple[list[int], list[int]]:
    img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    assert img is not None, f"fixture missing: {path}"
    processed, x_positions, _ = replace_x_noteheads(img)
    _, residual, _ = replace_x_noteheads(processed)
    return x_positions, residual


class TestReplacementCoversX:
    @pytest.mark.parametrize("path", [REF_DPI_CROP, PROD_DPI_CROP], ids=["ref-dpi", "300dpi"])
    def test_all_16_xheads_detected(self, path):
        x_positions, _ = _replace_then_redetect(path)
        assert len(x_positions) == 16

    @pytest.mark.parametrize("path", [REF_DPI_CROP, PROD_DPI_CROP], ids=["ref-dpi", "300dpi"])
    def test_replacement_fully_covers_x_strokes(self, path):
        _, residual = _replace_then_redetect(path)
        assert residual == [], (
            f"{len(residual)} x-noteheads still detectable after replacement — "
            "drawn round heads are too small for this DPI"
        )
