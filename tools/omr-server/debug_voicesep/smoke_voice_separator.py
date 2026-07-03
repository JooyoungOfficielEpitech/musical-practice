#!/usr/bin/env python
"""Smoke test: run voice_separator on 4 reference crops, save outputs."""

import cv2
import logging
from core.voice_separator import separate_voices_image

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def main():
    crops = [
        "debug_voicesep/spike_p1_Co-SA_0.png",
        "debug_voicesep/spike_p8_Co-SA_0.png",
        "debug_voicesep/spike_p8_Co-TB_0.png",
        "debug_voicesep/spike_p13_Co-SA_0.png",
    ]

    results = []
    for crop_path in crops:
        crop_name = crop_path.split('/')[-1].replace('.png', '')
        log.info(f"\n{'='*60}")
        log.info(f"Processing: {crop_name}")
        log.info(f"{'='*60}")

        img = cv2.imread(crop_path)
        if img is None:
            log.error(f"Failed to read {crop_path}")
            continue

        result = separate_voices_image(img)

        if result is None:
            log.warning(f"Separator returned None for {crop_name}")
            results.append({
                'name': crop_name,
                'status': 'None',
                'n_up': None,
                'n_down': None,
                'n_ambiguous': None,
            })
            continue

        up_path = f"debug_voicesep/sep_{crop_name}_up.png"
        down_path = f"debug_voicesep/sep_{crop_name}_down.png"

        cv2.imwrite(up_path, result.up_img)
        cv2.imwrite(down_path, result.down_img)

        log.info(f"✓ Saved: {up_path}")
        log.info(f"✓ Saved: {down_path}")
        log.info(f"Results: n_up={result.n_up}, n_down={result.n_down}, n_ambig={result.n_ambiguous}")

        results.append({
            'name': crop_name,
            'status': 'OK',
            'n_up': result.n_up,
            'n_down': result.n_down,
            'n_ambiguous': result.n_ambiguous,
        })

    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    for r in results:
        if r['status'] == 'OK':
            print(f"{r['name']:30s} | up={r['n_up']:2d} down={r['n_down']:2d} ambig={r['n_ambiguous']:2d}")
        else:
            print(f"{r['name']:30s} | {r['status']}")


if __name__ == '__main__':
    main()
