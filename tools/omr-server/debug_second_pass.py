#!/usr/bin/env python3
"""Debug second pass behavior on sys0."""

import cv2
import numpy as np
from pathlib import Path
from core.staff_cropper import _make_x_template, _binarize, _to_gray, _build_staff_mask

for crop_name in ["page01_char_CoSA_sys0_crop.png", "page01_char_CoSA_sys2_crop.png", "page01_char_Herm_sys0_crop.png"]:
    crop_path = Path("tests/fixtures/xhead_calibration") / crop_name
    img = cv2.imread(str(crop_path))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img.copy()
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    print(f"\n{crop_name}:")
    max_scores = []
    for size in (10, 11, 12):
        template = _make_x_template(size)
        res = cv2.matchTemplate(binary, template, cv2.TM_CCOEFF_NORMED)
        max_scores.append((size, np.max(res)))
    max_score = max(ms[1] for ms in max_scores)
    print(f"  Max score across sizes 10-12: {max_score:.4f}")
    if max_score >= 0.44:
        print(f"  -> Would trigger second pass!")
