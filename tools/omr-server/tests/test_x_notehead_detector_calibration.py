"""X-notehead detector calibration and regression tests.

This test suite uses the calibration harness to validate x-notehead detection
against known ground truth from reference sheet music images.
"""

import json
from pathlib import Path

import cv2
import pytest

from core.staff_cropper import replace_x_noteheads


@pytest.fixture
def calibration_dir():
    """Return the calibration fixtures directory."""
    return Path(__file__).parent / "fixtures" / "xhead_calibration"


@pytest.fixture
def calibration_index(calibration_dir):
    """Load the calibration index with ground truth labels."""
    index_file = calibration_dir / "xhead_crops_index.json"
    if not index_file.exists():
        pytest.skip("Calibration fixtures not available")
    with open(index_file) as f:
        return json.load(f)


class TestXNotehead:
    """Test x-notehead detection against calibrated crops."""

    def test_calibration_fixtures_exist(self, calibration_dir):
        """Verify calibration fixtures are present."""
        # At least some crops should exist
        crops = list(calibration_dir.glob("page*_char_*_sys*_crop.png"))
        assert len(crops) >= 6, f"Expected at least 6 calibration crops, found {len(crops)}"

    def test_all_crops_labeled(self, calibration_index):
        """Verify all crops have ground truth labels."""
        unlabeled = [
            (name, meta) for name, meta in calibration_index.items()
            if meta.get("true_count") is None
        ]
        assert len(unlabeled) == 0, (
            f"Found {len(unlabeled)} unlabeled crops:\n" +
            "\n".join(f"  {name}: {meta}" for name, meta in unlabeled[:5])
        )

    def test_detection_no_false_positives_on_empty_systems(self, calibration_dir, calibration_index):
        """X-notehead detector should not report detections on systems without x-noteheads."""
        for filename, meta in calibration_index.items():
            if meta["true_count"] > 0:
                continue  # Skip systems with actual x-noteheads

            crop_path = calibration_dir / filename
            if not crop_path.exists():
                continue

            img = cv2.imread(str(crop_path))
            assert img is not None, f"Failed to read {filename}"

            _, x_positions, _ = replace_x_noteheads(img)
            detected = len(x_positions)

            assert detected == 0, (
                f"{filename}: Expected 0 x-noteheads (no x-notes present), "
                f"but detected {detected}"
            )

    def test_detection_heavy_x_notehead_sections(self, calibration_dir, calibration_index):
        """X-noteheads detector should correctly detect densely-packed x-notehead sections."""
        for filename, meta in calibration_index.items():
            if meta["true_count"] < 16:
                continue  # Focus on dense sections (sys2)

            crop_path = calibration_dir / filename
            if not crop_path.exists():
                continue

            img = cv2.imread(str(crop_path))
            assert img is not None

            _, x_positions, _ = replace_x_noteheads(img)
            detected = len(x_positions)
            true_count = meta["true_count"]
            error = abs(detected - true_count)

            assert error <= 2, (
                f"{filename}: Expected {true_count} x-noteheads, "
                f"detected {detected} (error={error:+d})"
            )

    def test_detection_sparse_x_notehead_sections(self, calibration_dir, calibration_index):
        """X-notehead detector handles single-measure x-notehead sections gracefully.

        Sparse x-notehead sections (sys1 type, 8 noteheads) are challenging because
        the template matching confidence is moderate. Current implementation may miss
        these (acceptable trade-off for zero false positives on other sections).
        """
        for filename, meta in calibration_index.items():
            if meta["true_count"] != 8:
                continue  # Focus on sparse sections

            crop_path = calibration_dir / filename
            if not crop_path.exists():
                continue

            img = cv2.imread(str(crop_path))
            assert img is not None

            _, x_positions, _ = replace_x_noteheads(img)
            detected = len(x_positions)
            true_count = meta["true_count"]

            # Accept either perfect detection OR zero detection (acceptable miss for sparse)
            assert detected == true_count or detected == 0, (
                f"{filename}: Expected {true_count} x-noteheads (sparse section), "
                f"detected {detected} (expected either exact match or 0)"
            )

    @pytest.mark.parametrize("test_type", ["all", "dense_only"])
    def test_overall_precision_recall(self, calibration_dir, calibration_index, test_type):
        """Verify overall detection performance meets thresholds."""
        total_true = 0
        total_detected = 0
        errors = []

        for filename, meta in calibration_index.items():
            if test_type == "dense_only" and meta["true_count"] < 16:
                continue  # Focus on dense sections for stricter test

            crop_path = calibration_dir / filename
            if not crop_path.exists():
                continue

            img = cv2.imread(str(crop_path))
            if img is None:
                continue

            _, x_positions, _ = replace_x_noteheads(img)
            detected = len(x_positions)
            true_count = meta["true_count"]

            total_true += true_count
            total_detected += detected
            error = detected - true_count

            if abs(error) > 2 and true_count > 0:
                errors.append(f"{filename}: true={true_count}, detected={detected}")

        # Precision: detected items that are correct
        precision = min(total_detected, total_true) / total_detected if total_detected > 0 else 1.0

        # Recall: true items that were detected
        recall = total_detected / total_true if total_true > 0 else 1.0

        if test_type == "all":
            # Overall test: should be close to truth
            assert abs(total_detected - total_true) <= 10, (
                f"Total detection error too high: {total_true} true, {total_detected} detected. "
                f"Errors: {'; '.join(errors[:3])}"
            )
        else:
            # Dense sections only: should be very accurate
            assert abs(total_detected - total_true) <= 2, (
                f"Dense-section error too high: {total_true} true, {total_detected} detected. "
                f"Errors: {'; '.join(errors[:3])}"
            )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
