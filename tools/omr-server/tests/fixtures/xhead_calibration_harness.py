#!/usr/bin/env python3
"""Calibration harness for x-notehead detection.

Extracts staff crops from reference images using the production pipeline,
labels them with ground-truth x-notehead counts, and provides measurement tools
to evaluate detector precision/recall.
"""

import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

log = logging.getLogger("xhead_calibration")


class StaffCropExtractor:
    """Extract staff crops from a reference image using the production pipeline."""

    def __init__(self, fixtures_dir: Path):
        """Initialize with target fixtures directory."""
        self.fixtures_dir = fixtures_dir
        self.fixtures_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = self.fixtures_dir / "xhead_crops_index.json"

    def extract_from_image(
        self,
        image_path: str,
        page_num: int = 1,
        character_filter: Optional[str] = None,
    ) -> dict[str, list[tuple[Path, int]]]:
        """Extract all vocal staves from an image using the production pipeline.

        Args:
            image_path: Path to reference image
            page_num: Page number for naming
            character_filter: Only extract this character (e.g. "Hermes", "Co.SA")

        Returns:
            Dict mapping character name -> list of (crop_path, system_index)
        """
        from core.staff_cropper import crop_all_vocal_staves

        log.info(f"Extracting staves from {Path(image_path).name} (page {page_num})")

        img = cv2.imread(image_path)
        if img is None:
            log.error(f"Failed to read image: {image_path}")
            return {}

        staves_dict, system_info = crop_all_vocal_staves(img)

        result = {}
        for character, staff_list in staves_dict.items():
            if character_filter and character != character_filter:
                continue

            result[character] = []
            for sys_idx, (staff_image, _) in enumerate(staff_list):
                # Sanitize character name for filename
                safe_name = character.replace(" ", "_").replace(".", "")
                crop_name = f"page{page_num:02d}_char_{safe_name}_sys{sys_idx}_crop.png"
                crop_path = self.fixtures_dir / crop_name

                cv2.imwrite(str(crop_path), staff_image)
                result[character].append((crop_path, sys_idx))
                log.debug(f"  Saved {crop_name} (system {sys_idx})")

        return result

    def build_index(self) -> dict[str, dict]:
        """Build an index of all extracted crops with empty labels.

        Returns:
            Dict mapping crop filename -> {
                "crop_path": str,
                "character": str,
                "system_idx": int,
                "page_num": int,
                "true_count": Optional[int],  # To be filled by human labeling
                "notes": str  # Optional notes
            }
        """
        index = {}

        # Scan fixtures directory for crop files
        for crop_path in sorted(self.fixtures_dir.glob("page*_char_*_sys*_crop.png")):
            # Parse filename: page{page_num}_char_{char}_sys{sys_idx}_crop.png
            stem = crop_path.stem
            parts = stem.split("_")

            if len(parts) < 6:
                continue

            page_part = parts[0]  # "page01"
            char_parts = []
            sys_idx = None

            for i, part in enumerate(parts[2:], start=2):
                if part.startswith("sys"):
                    sys_idx = int(part[3:])
                    break
                char_parts.append(part)

            char_name = "_".join(char_parts).replace("_", " ").replace("Co", "Co.")
            page_num = int(page_part[4:])

            index[crop_path.name] = {
                "crop_path": str(crop_path),
                "character": char_name,
                "system_idx": sys_idx,
                "page_num": page_num,
                "true_count": None,
                "notes": "",
            }

        # Load existing labels if index exists
        if self.index_file.exists():
            try:
                with open(self.index_file) as f:
                    existing = json.load(f)
                    for key, val in existing.items():
                        if key in index:
                            index[key].update(val)
            except Exception as e:
                log.warning(f"Failed to load existing index: {e}")

        # Save updated index
        with open(self.index_file, "w") as f:
            json.dump(index, f, indent=2)

        return index

    def list_unlabeled(self) -> list[tuple[Path, dict]]:
        """List all crops that haven't been labeled yet (true_count is None).

        Returns:
            List of (crop_path, metadata) tuples
        """
        if not self.index_file.exists():
            return []

        with open(self.index_file) as f:
            index = json.load(f)

        result = []
        for filename, meta in index.items():
            if meta.get("true_count") is None:
                result.append((self.fixtures_dir / filename, meta))

        return result


class XHeadDetectionMeasurer:
    """Measure detector precision and recall against labeled crops."""

    def __init__(self, fixtures_dir: Path):
        """Initialize with fixtures directory."""
        self.fixtures_dir = fixtures_dir
        self.index_file = self.fixtures_dir / "xhead_crops_index.json"

    def measure_all(self) -> dict[str, dict]:
        """Run detector on all labeled crops, return precision/recall table.

        Returns:
            Dict mapping crop filename -> {
                "character": str,
                "system_idx": int,
                "true_count": int,
                "detected_count": int,
                "error": int,  # detected - true
                "precision": float,
                "recall": float,
                "x_positions": list[int],
                "status": "PASS" | "FAIL"
            }
        """
        from core.staff_cropper import replace_x_noteheads

        if not self.index_file.exists():
            log.error("Index file not found; run extract_from_image() first")
            return {}

        with open(self.index_file) as f:
            index = json.load(f)

        results = {}

        for filename, meta in index.items():
            if meta.get("true_count") is None:
                log.debug(f"Skipping unlabeled crop: {filename}")
                continue

            crop_path = self.fixtures_dir / filename
            if not crop_path.exists():
                log.warning(f"Crop file not found: {crop_path}")
                continue

            img = cv2.imread(str(crop_path))
            if img is None:
                log.error(f"Failed to read crop: {crop_path}")
                continue

            _, x_positions, _ = replace_x_noteheads(img)
            detected = len(x_positions)
            true_count = meta["true_count"]
            error = detected - true_count

            # Precision: detected that are correct (we approximate as min(detected, true))
            # Recall: true that were detected (we use detected/true)
            precision = (min(detected, true_count) / detected) if detected > 0 else 1.0 if true_count == 0 else 0.0
            recall = (detected / true_count) if true_count > 0 else (1.0 if detected == 0 else 0.0)

            status = "PASS" if abs(error) <= 2 else "FAIL"

            results[filename] = {
                "character": meta["character"],
                "system_idx": meta["system_idx"],
                "page_num": meta["page_num"],
                "true_count": true_count,
                "detected_count": detected,
                "error": error,
                "precision": precision,
                "recall": recall,
                "x_positions": x_positions,
                "status": status,
            }

        return results

    def print_table(self, results: dict[str, dict]) -> None:
        """Pretty-print precision/recall table."""
        print("\n" + "=" * 120)
        print("X-NOTEHEAD DETECTION PRECISION/RECALL TABLE")
        print("=" * 120)
        print(
            f"{'Character':<15} {'System':<8} {'Page':<6} {'True':<6} {'Detected':<10} "
            f"{'Error':<8} {'Precision':<12} {'Recall':<12} {'Status':<8}"
        )
        print("-" * 120)

        total_true = 0
        total_detected = 0
        pass_count = 0
        fail_count = 0

        for filename in sorted(results.keys()):
            r = results[filename]
            total_true += r["true_count"]
            total_detected += r["detected_count"]

            status = r["status"]
            if status == "PASS":
                pass_count += 1
            else:
                fail_count += 1

            print(
                f"{r['character']:<15} {r['system_idx']:<8} "
                f"{r['page_num']:<6} {r['true_count']:<6} {r['detected_count']:<10} "
                f"{r['error']:+<8} {r['precision']:.3f}      {r['recall']:.3f}      {status:<8}"
            )

        print("-" * 120)
        print(
            f"{'TOTAL':<15} {'':<8} {'':<6} {total_true:<6} {total_detected:<10} "
            f"{total_detected - total_true:+<8} {'':<12} {'':<12} "
            f"{pass_count} PASS, {fail_count} FAIL"
        )
        print("=" * 120 + "\n")

    def export_results(self, results: dict[str, dict], output_path: Path) -> None:
        """Export results as JSON."""
        with open(output_path, "w") as f:
            json.dump(results, f, indent=2)
        log.info(f"Results exported to {output_path}")


def main():
    """CLI tool for harness management."""
    import argparse
    import sys

    parser = argparse.ArgumentParser(
        description="Calibration harness for x-notehead detection"
    )
    subparsers = parser.add_subparsers(dest="command")

    # Extract subcommand
    extract_parser = subparsers.add_parser("extract", help="Extract crops from reference images")
    extract_parser.add_argument("image", help="Path to reference image")
    extract_parser.add_argument("--page", type=int, default=1, help="Page number")
    extract_parser.add_argument("--character", help="Filter to specific character")
    extract_parser.add_argument("--output-dir", help="Fixtures directory (default: tests/fixtures)")

    # Index subcommand
    index_parser = subparsers.add_parser("index", help="Build index of extracted crops")
    index_parser.add_argument("--output-dir", help="Fixtures directory (default: tests/fixtures)")

    # List subcommand
    list_parser = subparsers.add_parser("list", help="List unlabeled crops")
    list_parser.add_argument("--output-dir", help="Fixtures directory (default: tests/fixtures)")

    # Measure subcommand
    measure_parser = subparsers.add_parser("measure", help="Measure detector on labeled crops")
    measure_parser.add_argument("--output-dir", help="Fixtures directory (default: tests/fixtures)")
    measure_parser.add_argument("--export", help="Export results to JSON file")

    args = parser.parse_args()

    # Default fixtures dir
    fixtures_dir = Path(args.output_dir or "tests/fixtures/xhead_calibration")

    logging.basicConfig(level=logging.INFO)

    if args.command == "extract":
        extractor = StaffCropExtractor(fixtures_dir)
        extractor.extract_from_image(args.image, args.page, args.character)
        print(f"Crops extracted to {fixtures_dir}")

    elif args.command == "index":
        extractor = StaffCropExtractor(fixtures_dir)
        index = extractor.build_index()
        print(f"Index built: {len(index)} crops")
        print(f"Index saved to {extractor.index_file}")

    elif args.command == "list":
        extractor = StaffCropExtractor(fixtures_dir)
        unlabeled = extractor.list_unlabeled()
        if unlabeled:
            print(f"Unlabeled crops ({len(unlabeled)}):")
            for crop_path, meta in unlabeled:
                print(
                    f"  {crop_path.name}: {meta['character']} "
                    f"(page {meta['page_num']}, sys {meta['system_idx']})"
                )
        else:
            print("No unlabeled crops found")

    elif args.command == "measure":
        measurer = XHeadDetectionMeasurer(fixtures_dir)
        results = measurer.measure_all()
        measurer.print_table(results)
        if args.export:
            measurer.export_results(results, Path(args.export))

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
