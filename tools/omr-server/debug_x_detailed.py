#!/usr/bin/env python3
"""Detailed debug to see ALL scores >= 0.50 for sys0."""

import cv2
import numpy as np
from pathlib import Path
from core.staff_cropper import _make_x_template

crop_path = Path("tests/fixtures/xhead_calibration/page01_char_CoSA_sys0_crop.png")
img = cv2.imread(str(crop_path))
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
_, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

print(f"Checking {crop_path.name}:")
for size in (8, 9, 10, 11, 12, 13, 14, 15):
    template = _make_x_template(size)
    res = cv2.matchTemplate(binary, template, cv2.TM_CCOEFF_NORMED)
    locs_50 = np.where(res >= 0.50)
    count_50 = len(locs_50[0])
    if count_50 > 0:
        print(f"  size {size}: {count_50} matches >= 0.50, max = {np.max(res):.4f}")
