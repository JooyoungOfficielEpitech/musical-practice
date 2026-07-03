#!/usr/bin/env python3
"""Extract Co.SA and Co.TB crops from reference pages 001, 008, 013."""

import os
import sys
import logging

import cv2

# Add local modules to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.staff_cropper import crop_all_vocal_staves

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

REFERENCE_DIR = "/Users/mmecoco/Desktop/musical-practice/tools/omr-server/reference"
DEBUG_DIR = "/Users/mmecoco/Desktop/musical-practice/tools/omr-server/debug_voicesep"

# Pages to process
PAGES = ["001", "008", "013"]

def main():
    """Extract and save Co.SA and Co.TB crops."""
    os.makedirs(DEBUG_DIR, exist_ok=True)

    all_crops = []

    for page in PAGES:
        img_path = os.path.join(REFERENCE_DIR, f"하데스타운 악보 통합본-{page}.png")
        if not os.path.exists(img_path):
            log.warning(f"Image not found: {img_path}")
            continue

        log.info(f"Processing page {page}...")
        img = cv2.imread(img_path)
        if img is None:
            log.error(f"Failed to read image: {img_path}")
            continue

        staves_dict, system_info = crop_all_vocal_staves(img)
        log.info(f"  Found {len(staves_dict)} character(s), {len(system_info)} system(s)")

        # Filter for Co.SA and Co.TB
        for char_name in ["Co.SA", "Co.TB"]:
            if char_name not in staves_dict:
                continue

            crops = staves_dict[char_name]
            log.info(f"  {char_name}: {len(crops)} crop(s)")

            for idx, (crop_img, sys_idx) in enumerate(crops):
                output_name = f"page_{page}_{char_name}_sys{sys_idx}.png"
                output_path = os.path.join(DEBUG_DIR, output_name)
                cv2.imwrite(output_path, crop_img)
                log.info(f"    Saved: {output_name}")
                all_crops.append({
                    "page": page,
                    "char": char_name,
                    "sys_idx": sys_idx,
                    "path": output_path,
                })

    log.info(f"\nTotal crops extracted: {len(all_crops)}")
    for crop in all_crops:
        log.info(f"  {crop['path']}")

    return all_crops

if __name__ == "__main__":
    main()
