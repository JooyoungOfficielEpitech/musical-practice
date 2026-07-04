#!/usr/bin/env python3
"""Test voice separation on x-notehead crops (CoTB and CoSA)."""

import sys
import cv2
import numpy as np
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from core.voice_separator import separate_voices_image

def test_voice_separation(fixture_path):
    """Load fixture, run voice separation, save and report results."""
    img = cv2.imread(str(fixture_path))
    if img is None:
        print(f"ERROR: Could not load {fixture_path}")
        return

    print(f"\n{'='*60}")
    print(f"Testing: {fixture_path.name}")
    print(f"Image shape: {img.shape}")

    result = separate_voices_image(img)

    if result is None:
        print("Voice separation returned None (likely monophonic or too few staff lines)")
        return

    print(f"Separation result:")
    print(f"  Up voice components: {result.n_up}")
    print(f"  Down voice components: {result.n_down}")
    print(f"  Ambiguous components: {result.n_ambiguous}")

    # Save the up and down images for visual inspection
    base_path = fixture_path.parent / fixture_path.stem
    up_path = base_path.parent / f"{base_path.name}_up.png"
    down_path = base_path.parent / f"{base_path.name}_down.png"

    cv2.imwrite(str(up_path), result.up_img)
    cv2.imwrite(str(down_path), result.down_img)

    print(f"  Saved up image: {up_path.name}")
    print(f"  Saved down image: {down_path.name}")

    # Quick visual check: count non-white pixels in each voice image
    # (proxy for "did the x-noteheads survive?")
    up_ink = np.count_nonzero(result.up_img < 200)
    down_ink = np.count_nonzero(result.down_img < 200)
    print(f"  Up image ink pixels: {up_ink}")
    print(f"  Down image ink pixels: {down_ink}")


if __name__ == "__main__":
    fixture_dir = Path("/Users/mmecoco/Desktop/musical-practice/tools/omr-server/tests/fixtures/xhead_calibration")

    # Test both CoTB (has x-noteheads) and CoSA (for contrast)
    test_fixtures = [
        fixture_dir / "page01_char_CoTB_sys2_crop.png",
        fixture_dir / "page01_char_CoSA_sys2_crop.png",
    ]

    for fixture in test_fixtures:
        if fixture.exists():
            test_voice_separation(fixture)
        else:
            print(f"ERROR: Fixture not found: {fixture}")

    print(f"\n{'='*60}")
    print("Check the _up.png and _down.png files visually to see if x-noteheads survived.")
