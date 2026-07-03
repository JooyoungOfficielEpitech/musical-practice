#!/usr/bin/env python3
"""Test script to measure x-notehead detection behavior on real staff crops."""

import cv2
import numpy as np
from pathlib import Path
from core.staff_cropper import replace_x_noteheads

# Reference crops with known x-notehead counts
TEST_CASES = [
    # (path, expected_count, description)
    ("reference/debug_하데스타운 악보 통합본-001/page01_char_Herm_sys0_1_crop.png", 0, "Hermes sys0: no x-heads"),
    ("reference/debug_하데스타운 악보 통합본-001/page01_char_Herm_sys1_1_crop.png", 8, "Hermes sys1: 8 x-heads (1 measure)"),
    ("reference/debug_하데스타운 악보 통합본-001/page01_char_Herm_sys2_1_crop.png", 24, "Hermes sys2: 24 x-heads (3 measures)"),
    ("reference/debug_하데스타운 악보 통합본-001/page01_char_CoSA_sys0_1_crop.png", 0, "Company SA sys0: no x-heads"),
    ("reference/debug_하데스타운 악보 통합본-001/page01_char_CoSA_sys2_1_crop.png", 16, "Company SA sys2: 16 x-heads (2 measures)"),
]

def run_tests():
    """Run detection tests and print results."""
    print("=" * 80)
    print("X-NOTEHEAD DETECTION TEST RESULTS")
    print("=" * 80)

    total_expected = 0
    total_detected = 0
    failures = []

    for img_path, expected_count, description in TEST_CASES:
        full_path = Path(img_path)
        if not full_path.exists():
            print(f"SKIP: {description}")
            print(f"  File not found: {img_path}\n")
            continue

        img = cv2.imread(str(full_path))
        if img is None:
            print(f"SKIP: {description}")
            print(f"  Failed to read image: {img_path}\n")
            continue

        _, x_positions, _ = replace_x_noteheads(img)
        detected_count = len(x_positions)

        total_expected += expected_count
        total_detected += detected_count

        status = "PASS" if detected_count == expected_count else "FAIL"
        error = detected_count - expected_count

        print(f"{status}: {description}")
        print(f"  Expected: {expected_count}, Detected: {detected_count}, Error: {error:+d}")
        print(f"  X-positions: {x_positions[:10]}{'...' if len(x_positions) > 10 else ''}")
        print()

        if status == "FAIL":
            failures.append((description, expected_count, detected_count))

    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total Expected: {total_expected}")
    print(f"Total Detected: {total_detected}")
    print(f"Total Error: {total_detected - total_expected:+d}")

    if failures:
        print("\nFAILURES:")
        for desc, expected, detected in failures:
            print(f"  - {desc}: expected {expected}, got {detected}")

    return len(failures) == 0

if __name__ == "__main__":
    import sys
    success = run_tests()
    sys.exit(0 if success else 1)
