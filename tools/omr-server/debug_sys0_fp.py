#!/usr/bin/env python3
"""Find the false positive matches in sys0."""

import cv2
import numpy as np
from pathlib import Path
from core.staff_cropper import _make_x_template, _binarize, _to_gray, _build_staff_mask

for crop_name in ["page01_char_CoSA_sys0_crop.png", "page01_char_Herm_sys0_crop.png"]:
    crop_path = Path("tests/fixtures/xhead_calibration") / crop_name
    img = cv2.imread(str(crop_path))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img.copy()
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    staff_mask = _build_staff_mask(binary)

    print(f"\n{crop_name}:")
    for size in (8, 9, 10, 11, 12, 13, 14, 15):
        template = _make_x_template(size)
        res = cv2.matchTemplate(binary, template, cv2.TM_CCOEFF_NORMED)
        locs_thresh = np.where(res >= 0.505)
        matches = []
        for pt_y, pt_x in zip(*locs_thresh):
            cx = pt_x + size // 2
            cy = pt_y + size // 2
            if cy < staff_mask.shape[0] and cx < staff_mask.shape[1]:
                if staff_mask[cy, cx] == 0:
                    continue
            matches.append((res[pt_y, pt_x], pt_x, pt_y))

        if matches:
            print(f"  size {size}: {len(matches)} matches >= 0.505")
            for score, x, y in sorted(matches, reverse=True)[:3]:
                print(f"    score={score:.4f} at ({x},{y})")
