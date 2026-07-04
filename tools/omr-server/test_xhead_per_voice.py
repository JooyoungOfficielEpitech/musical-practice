#!/usr/bin/env python3
"""Test per-voice OMR detection on x-notehead separated images (CoTB sys2)."""

import sys
import cv2
import subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from core.voice_separator import separate_voices_image


def test_per_voice_detection():
    """Run the per-voice OMR pipeline on separated x-notehead images."""
    fixture_dir = Path("tests/fixtures/xhead_calibration")
    orig_path = fixture_dir / "page01_char_CoTB_sys2_crop.png"

    img = cv2.imread(str(orig_path))
    result = separate_voices_image(img)

    assert result is not None, "Voice separation should succeed"

    # Save up and down images
    up_path = fixture_dir / "xhead_per_voice_up.png"
    down_path = fixture_dir / "xhead_per_voice_down.png"

    cv2.imwrite(str(up_path), result.up_img)
    cv2.imwrite(str(down_path), result.down_img)

    print(f"Saved separated images:")
    print(f"  Up: {up_path.name}")
    print(f"  Down: {down_path.name}")

    # Run homr on each image to detect notes
    for voice_name, voice_img_path in [("up", up_path), ("down", down_path)]:
        # Convert grayscale to RGB for homr
        img_rgb = cv2.cvtColor(result.up_img if voice_name == "up" else result.down_img,
                               cv2.COLOR_GRAY2BGR)
        temp_path = fixture_dir / f"xhead_per_voice_{voice_name}_temp.png"
        cv2.imwrite(str(temp_path), img_rgb)

        # Run homr
        try:
            homr_result = subprocess.run(
                ["python", "-m", "homr", str(temp_path)],
                capture_output=True,
                text=True,
                timeout=15,
            )
            if homr_result.returncode == 0:
                xml = homr_result.stdout
                # Count notes in XML (simple check: count <pitch> tags)
                n_notes = xml.count("<pitch>")
                print(f"\n{voice_name.upper()} voice - Detected {n_notes} notes/pitches")
            else:
                print(f"\n{voice_name.upper()} voice - homr failed: {homr_result.stderr}")
        except Exception as e:
            print(f"\n{voice_name.upper()} voice - Error running homr: {e}")

        # Clean up temp file
        if temp_path.exists():
            temp_path.unlink()


if __name__ == "__main__":
    test_per_voice_detection()
