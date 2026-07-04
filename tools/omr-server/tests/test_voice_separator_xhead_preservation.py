"""Test that voice separation preserves x-noteheads in BOTH voice images.

X-noteheads are unpitched (spoken content) and should not be erased from
either voice image. They must survive in both up and down images.
"""

import numpy as np
import cv2
from pathlib import Path

from core.voice_separator import separate_voices_image


FIXTURE_DIR = Path(__file__).parent / "fixtures" / "xhead_calibration"


def _count_dark_pixels(img: np.ndarray, threshold: int = 200) -> int:
    """Count pixels darker than threshold (ink measure)."""
    return int(np.count_nonzero(img < threshold))


class TestXNotaheadPreservation:
    """X-noteheads must stay in both voice images (they are ambiguous/unpitched)."""

    def test_cotb_sys2_xheads_in_up_image(self):
        """CoTB sys2 has x-noteheads; they should appear in the up voice image."""
        fixture_path = FIXTURE_DIR / "page01_char_CoTB_sys2_crop.png"
        if not fixture_path.exists():
            pytest.skip(f"Fixture not found: {fixture_path}")

        img = cv2.imread(str(fixture_path))
        result = separate_voices_image(img)

        assert result is not None, "Voice separation should succeed on CoTB sys2"

        # The x-noteheads in m12-14 should leave visible ink in the up_img.
        # In the m12-14 region (rough: y=60-90, x=700-1400), we expect dark pixels.
        up_crop = result.up_img[60:90, 700:1400]
        up_ink = _count_dark_pixels(up_crop)

        # Before fix: up_ink would be very low (mostly white/erased)
        # After fix: up_ink should be significant (~3000+)
        assert up_ink > 1500, (
            f"X-noteheads should survive in up image; found only {up_ink} dark pixels "
            "in m12-14 region. They were likely erased."
        )

    def test_cotb_sys2_xheads_in_down_image(self):
        """CoTB sys2 x-noteheads should also appear in the down voice image."""
        fixture_path = FIXTURE_DIR / "page01_char_CoTB_sys2_crop.png"
        if not fixture_path.exists():
            pytest.skip(f"Fixture not found: {fixture_path}")

        img = cv2.imread(str(fixture_path))
        result = separate_voices_image(img)

        assert result is not None, "Voice separation should succeed on CoTB sys2"

        # The x-noteheads in m12-14 region should appear in down_img too
        down_crop = result.down_img[60:90, 700:1400]
        down_ink = _count_dark_pixels(down_crop)

        assert down_ink > 1500, (
            f"X-noteheads should survive in down image; found only {down_ink} dark pixels "
            "in m12-14 region."
        )

    def test_xheads_survive_similar_in_both(self):
        """X-noteheads should be present similarly in both voice images (ambiguous content)."""
        fixture_path = FIXTURE_DIR / "page01_char_CoTB_sys2_crop.png"
        if not fixture_path.exists():
            pytest.skip(f"Fixture not found: {fixture_path}")

        img = cv2.imread(str(fixture_path))
        result = separate_voices_image(img)

        assert result is not None

        # m12-14 region with x-noteheads
        up_crop = result.up_img[60:90, 700:1400]
        down_crop = result.down_img[60:90, 700:1400]

        up_ink = _count_dark_pixels(up_crop)
        down_ink = _count_dark_pixels(down_crop)

        # Both should be roughly similar (within 20% of each other) since
        # x-noteheads are ambiguous and should stay in both
        diff_ratio = abs(up_ink - down_ink) / max(up_ink, down_ink)
        assert diff_ratio < 0.25, (
            f"X-noteheads should appear similarly in both images. "
            f"Up: {up_ink}, Down: {down_ink}, diff: {diff_ratio:.1%}"
        )

    def test_separation_coefficients_nonzero(self):
        """The voice separator should report nonzero up/down counts (separation happened)."""
        fixture_path = FIXTURE_DIR / "page01_char_CoTB_sys2_crop.png"
        if not fixture_path.exists():
            pytest.skip(f"Fixture not found: {fixture_path}")

        img = cv2.imread(str(fixture_path))
        result = separate_voices_image(img)

        assert result is not None
        assert result.n_up > 0, "Should detect some up-voice components"
        assert result.n_down > 0, "Should detect some down-voice components"


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
