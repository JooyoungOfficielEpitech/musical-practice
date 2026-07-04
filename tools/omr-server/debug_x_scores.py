#!/usr/bin/env python3
"""Debug script to see match scores for different crops."""

import cv2
import numpy as np
from pathlib import Path
from core.staff_cropper import _make_x_template, _binarize, _to_gray

crops_dir = Path("tests/fixtures/xhead_calibration")

for crop_path in sorted(crops_dir.glob("*.png")):
    if "crop" not in crop_path.name:
        continue

    img = cv2.imread(str(crop_path))
    if img is None:
        continue

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img.copy()
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    print(f"\n{crop_path.name}:")
    for size in (10, 11, 12, 13):
        template = _make_x_template(size)
        res = cv2.matchTemplate(binary, template, cv2.TM_CCOEFF_NORMED)
        max_score = np.max(res)
        max_loc = np.unravel_index(np.argmax(res), res.shape)
        print(f"  size {size}: max_score={max_score:.4f} at {max_loc}")
