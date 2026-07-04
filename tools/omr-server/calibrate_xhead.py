#!/usr/bin/env python3
"""Calibration harness for x-notehead detection.

Extracts staff crops from reference images using the production pipeline,
labels them with ground-truth x-notehead counts, and provides measurement tools
to evaluate detector precision/recall.
"""

import json
import logging
import sys
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from core.staff_cropper import crop_all_vocal_staves, replace_x_noteheads

log = logging.getLogger("xhead_calibration")


class StaffCropExtractor:
    """Extract staff crops from a reference image using the production pipeline."""

    def __init__(self, fixtures_dir: Path):
        """Initialize with target fixtures directory."""
        self.fixtures_dir = Path(fixtures_dir)
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
                log.info(f"  Saved {crop_name} (system {sys_idx})")

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
            # Example: page01_char_Herm_sys0_crop.png or page01_char_CoSA_sys1_crop.png
            filename = crop_path.name
            stem = crop_path.stem

            # Extract page number
            if not stem.startswith("page"):
                continue
            page_end = stem.index("_char")
            page_num = int(stem[4:page_end])

            # Extract system index
            sys_start = stem.rfind("_sys")
            if sys_start == -1:
                continue
            sys_end = stem.rfind("_crop")
            sys_idx = int(stem[sys_start + 4:sys_end])

            # Extract character name (between "page##_char_" and "_sys##")
            char_start = stem.index("_char_") + 6
            char_name = stem[char_start:sys_start]
            # Restore proper casing for compound names
            if char_name.startswith("Co"):
                char_name = "Co." + char_name[2:]

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

        return sorted(result, key=lambda x: (x[1]["page_num"], x[1]["system_idx"]))


class XHeadDetectionMeasurer:
    """Measure detector precision and recall against labeled crops."""

    def __init__(self, fixtures_dir: Path):
        """Initialize with fixtures directory."""
        self.fixtures_dir = Path(fixtures_dir)
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
        if not self.index_file.exists():
            log.error("Index file not found; run extract_from_image() first")
            return {}

        with open(self.index_file) as f:
            index = json.load(f)

        results = {}

        for filename, meta in sorted(index.items()):
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
        print("\n" + "=" * 130)
        print("X-NOTEHEAD DETECTION PRECISION/RECALL TABLE")
        print("=" * 130)
        print(
            f"{'Crop':<40} {'Char':<12} {'Sys':<5} {'True':<6} {'Det':<6} "
            f"{'Err':<6} {'Prec':<8} {'Recall':<8} {'Status':<8}"
        )
        print("-" * 130)

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

            crop_short = filename[:40]
            print(
                f"{crop_short:<40} {r['character']:<12} {r['system_idx']:<5} "
                f"{r['true_count']:<6} {r['detected_count']:<6} {r['error']:+<6} "
                f"{r['precision']:.3f}   {r['recall']:.3f}    {status:<8}"
            )

        print("-" * 130)
        overall_prec = total_detected / total_true if total_true > 0 else 0
        overall_recall = total_detected / total_true if total_true > 0 else 0
        print(
            f"{'TOTAL':<40} {'':<12} {'':<5} {total_true:<6} {total_detected:<6} "
            f"{total_detected - total_true:+<6} {overall_prec:.3f}   {overall_recall:.3f}    "
            f"{pass_count} PASS, {fail_count} FAIL"
        )
        print("=" * 130 + "\n")

    def export_results(self, results: dict[str, dict], output_path: Path) -> None:
        """Export results as JSON."""
        # Convert numpy types to Python native types
        clean_results = {}
        for key, val in results.items():
            clean_val = {}
            for k, v in val.items():
                if k == "x_positions":
                    clean_val[k] = [int(x) for x in v]
                elif isinstance(v, (np.integer, np.floating)):
                    clean_val[k] = float(v) if isinstance(v, np.floating) else int(v)
                else:
                    clean_val[k] = v
            clean_results[key] = clean_val

        with open(output_path, "w") as f:
            json.dump(clean_results, f, indent=2)
        log.info(f"Results exported to {output_path}")


def main():
    """CLI tool for harness management."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Calibration harness for x-notehead detection"
    )
    subparsers = parser.add_subparsers(dest="command")

    # Extract subcommand
    extract_parser = subparsers.add_parser("extract", help="Extract crops from reference images")
    extract_parser.add_argument("image", help="Path to reference image")
    extract_parser.add_argument("--page", type=int, default=1, help="Page number")
    extract_parser.add_argument("--character", help="Filter to specific character")
    extract_parser.add_argument("--output-dir", default="tests/fixtures/xhead_calibration", help="Fixtures directory")

    # Index subcommand
    index_parser = subparsers.add_parser("index", help="Build index of extracted crops")
    index_parser.add_argument("--output-dir", default="tests/fixtures/xhead_calibration", help="Fixtures directory")

    # List subcommand
    list_parser = subparsers.add_parser("list", help="List unlabeled crops")
    list_parser.add_argument("--output-dir", default="tests/fixtures/xhead_calibration", help="Fixtures directory")

    # Label subcommand
    label_parser = subparsers.add_parser("label", help="Label a crop with true x-notehead count")
    label_parser.add_argument("crop_filename", help="Filename of crop to label")
    label_parser.add_argument("--count", type=int, required=True, help="True x-notehead count")
    label_parser.add_argument("--notes", default="", help="Optional notes")
    label_parser.add_argument("--output-dir", default="tests/fixtures/xhead_calibration", help="Fixtures directory")

    # Measure subcommand
    measure_parser = subparsers.add_parser("measure", help="Measure detector on labeled crops")
    measure_parser.add_argument("--output-dir", default="tests/fixtures/xhead_calibration", help="Fixtures directory")
    measure_parser.add_argument("--export", help="Export results to JSON file")

    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    fixtures_dir = Path(args.output_dir)

    if args.command == "extract":
        extractor = StaffCropExtractor(fixtures_dir)
        extractor.extract_from_image(args.image, args.page, args.character)
        print(f"Crops extracted to {fixtures_dir}")
        extractor.build_index()

    elif args.command == "index":
        extractor = StaffCropExtractor(fixtures_dir)
        index = extractor.build_index()
        print(f"Index built: {len(index)} crops")
        print(f"Index saved to {extractor.index_file}")

    elif args.command == "list":
        extractor = StaffCropExtractor(fixtures_dir)
        unlabeled = extractor.list_unlabeled()
        if unlabeled:
            print(f"\nUnlabeled crops ({len(unlabeled)}):\n")
            for i, (crop_path, meta) in enumerate(unlabeled, 1):
                print(f"{i:2d}. {crop_path.name}")
                print(f"    Character: {meta['character']}, System: {meta['system_idx']}, Page: {meta['page_num']}")
        else:
            print("No unlabeled crops found")

    elif args.command == "label":
        extractor = StaffCropExtractor(fixtures_dir)
        if not extractor.index_file.exists():
            print("Index not found; run 'index' first")
            sys.exit(1)
        with open(extractor.index_file) as f:
            index = json.load(f)
        if args.crop_filename not in index:
            print(f"Crop not found: {args.crop_filename}")
            sys.exit(1)
        index[args.crop_filename]["true_count"] = args.count
        if args.notes:
            index[args.crop_filename]["notes"] = args.notes
        with open(extractor.index_file, "w") as f:
            json.dump(index, f, indent=2)
        print(f"Labeled {args.crop_filename}: {args.count} x-noteheads")

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
