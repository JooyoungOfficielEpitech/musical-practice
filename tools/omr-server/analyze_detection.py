#!/usr/bin/env python3
"""Analyze detection behavior in detail."""

import cv2
import numpy as np
from pathlib import Path
from core.staff_cropper import _make_x_template, _build_staff_mask

def analyze_detection(img_path: str, description: str):
    """Analyze x-notehead detection on a single image."""
    print(f"\n{'='*80}")
    print(f"ANALYZING: {description}")
    print(f"{'='*80}")

    img = cv2.imread(img_path)
    if img is None:
        print(f"Failed to read: {img_path}")
        return

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img.copy()
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    staff_mask = _build_staff_mask(binary)

    print(f"Image shape: {img.shape}")
    print(f"Binary shape: {binary.shape}")
    print(f"Staff mask coverage: {np.sum(staff_mask > 0) / staff_mask.size * 100:.1f}%")

    all_matches = []

    for size in (9, 11, 13):
        template = _make_x_template(size)
        res = cv2.matchTemplate(binary, template, cv2.TM_CCOEFF_NORMED)

        # Count at different thresholds
        for threshold in [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6]:
            locs = np.where(res >= threshold)
            count = len(locs[0])
            print(f"  Template size {size:2d}, threshold {threshold:.2f}: {count:3d} matches")

        # Collect all matches at 0.4 threshold
        locs = np.where(res >= 0.4)
        for pt_y, pt_x in zip(*locs):
            cx = pt_x + size // 2
            cy = pt_y + size // 2
            score = res[pt_y, pt_x]
            in_staff = staff_mask[cy, cx] > 0 if (cy < staff_mask.shape[0] and cx < staff_mask.shape[1]) else False
            all_matches.append((cx, cy, size, score, in_staff))

    print(f"\nTotal raw matches at 0.4 threshold: {len(all_matches)}")

    # Analyze by staff mask
    in_staff = [m for m in all_matches if m[4]]
    out_staff = [m for m in all_matches if not m[4]]
    print(f"  In staff region: {len(in_staff)}")
    print(f"  Outside staff: {len(out_staff)}")

    # After NMS dedup (current logic)
    all_matches.sort(key=lambda m: -m[3])
    kept = []
    for cx, cy, sz, score, in_staff in all_matches:
        if not any(abs(cx - kx) < 10 and abs(cy - ky) < 10 for kx, ky, _, _, _ in kept):
            kept.append((cx, cy, sz, score, in_staff))

    print(f"After NMS dedup (10px threshold): {len(kept)}")
    kept_in_staff = [m for m in kept if m[4]]
    print(f"  Kept in staff region: {len(kept_in_staff)}")

if __name__ == "__main__":
    test_cases = [
        ("reference/debug_하데스타운 악보 통합본-001/page01_char_Herm_sys0_1_crop.png", "Hermes sys0: no x-heads"),
        ("reference/debug_하데스타운 악보 통합본-001/page01_char_Herm_sys1_1_crop.png", "Hermes sys1: 8 x-heads"),
        ("reference/debug_하데스타운 악보 통합본-001/page01_char_CoSA_sys0_1_crop.png", "Company SA sys0: no x-heads"),
    ]

    for img_path, desc in test_cases:
        if Path(img_path).exists():
            analyze_detection(img_path, desc)
