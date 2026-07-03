#!/usr/bin/env python3
"""
Hypothesis gate: test erase-style voice separation with homr.

Hypothesis: homr WILL read an erase-from-original image (original grayscale,
one voice erased, staff lines redrawn through erased areas).

Procedure:
1. Load original crop (grayscale)
2. Classify stems via spike algorithm
3. Build erase-style images: white-fill opposite voice, redraw staff lines
4. Run homr on each; parse outputs for pitched notes
5. Test variants if homr fails (blur, dilation, inpainting, etc.)
6. Record winning recipe if any variant succeeds
"""

import cv2
import numpy as np
import logging
import subprocess
import os
from typing import Optional, Dict, Tuple, List

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger(__name__)


class ErasStyleVoiceTest:
    """Test erase-style voice separation on a single crop."""

    def __init__(self, crop_path: str, crop_name: str, output_dir: str = "."):
        self.crop_path = crop_path
        self.crop_name = crop_name
        self.output_dir = output_dir
        self.original = None
        self.binary = None
        self.staff_lines = None
        self.staff_spacing = None
        self.noteheads = None
        self.classifications = None

    def load_and_binarize(self) -> bool:
        """Load original, convert to grayscale, binarize."""
        self.original = cv2.imread(self.crop_path)
        if self.original is None:
            log.error(f"Failed to load {self.crop_path}")
            return False

        gray = cv2.cvtColor(self.original, cv2.COLOR_BGR2GRAY)
        _, self.binary = cv2.threshold(
            gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )
        log.info(f"Loaded {self.crop_path}: {self.original.shape}")
        return True

    def detect_staff_lines(self) -> bool:
        """Detect staff line rows."""
        h, w = self.binary.shape
        kernel_width = max(w // 4, 100)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_width, 1))
        horiz = cv2.morphologyEx(self.binary, cv2.MORPH_OPEN, kernel)

        row_sums = np.sum(horiz, axis=1) / 255
        threshold = w * 0.15
        staff_rows = (row_sums > threshold).astype(np.uint8)

        lines = []
        in_line = False
        start = 0
        for i, val in enumerate(staff_rows):
            if val and not in_line:
                start = i
                in_line = True
            elif not val and in_line:
                lines.append((start, i - 1))
                in_line = False
        if in_line:
            lines.append((start, len(staff_rows) - 1))

        if not lines:
            log.error("No staff lines detected")
            return False

        merged = [lines[0]]
        for top, bot in lines[1:]:
            prev_top, prev_bot = merged[-1]
            if top - prev_bot <= 3:
                merged[-1] = (prev_top, bot)
            else:
                merged.append((top, bot))

        line_centers = [(t + b) / 2 for t, b in merged]
        gaps = [
            line_centers[i + 1] - line_centers[i]
            for i in range(len(line_centers) - 1)
        ]
        self.staff_spacing = np.median(gaps) if gaps else 10

        self.staff_lines = merged
        log.info(f"Detected {len(merged)} staff lines, spacing={self.staff_spacing:.1f}")
        return True

    def classify_stems(self) -> bool:
        """Classify stems via spike algorithm."""
        binary_no_staff = self.binary.copy()
        for top, bot in self.staff_lines:
            margin = int((bot - top + 1) * 1.2)
            y1 = max(0, top - margin)
            y2 = min(binary_no_staff.shape[0], bot + margin + 1)
            binary_no_staff[y1:y2, :] = 0

        kernel_height = int(self.staff_spacing * 1.8)
        kernel_height = max(3, kernel_height)
        v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, kernel_height))
        stems = cv2.morphologyEx(binary_no_staff, cv2.MORPH_OPEN, v_kernel)

        num_features, labeled = cv2.connectedComponents(binary_no_staff)
        noteheads = []
        for label_id in range(1, num_features + 1):
            mask = labeled == label_id
            y, x = np.where(mask)

            if len(y) < 5:
                continue

            min_y, max_y = y.min(), y.max()
            min_x, max_x = x.min(), x.max()
            h = max_y - min_y + 1
            w = max_x - min_x + 1

            expected_h = int(self.staff_spacing / 1.5)
            if abs(h - expected_h) > expected_h * 0.8:
                continue

            aspect = w / h if h > 0 else 0
            if not (0.5 < aspect < 2.0):
                continue

            cy = (min_y + max_y) / 2
            cx = (min_x + max_x) / 2
            noteheads.append(
                {
                    "label": label_id,
                    "mask": mask,
                    "cx": cx,
                    "cy": cy,
                    "y_min": min_y,
                    "y_max": max_y,
                    "x_min": min_x,
                    "x_max": max_x,
                    "h": h,
                    "w": w,
                }
            )

        if not noteheads:
            log.error("No noteheads detected")
            return False

        classifications = []
        for notehead in noteheads:
            cx, cy = notehead["cx"], notehead["cy"]
            search_x_right = int(cx + self.staff_spacing * 0.3)
            search_y_up_start = max(0, int(cy - self.staff_spacing * 2))
            search_y_up_end = int(cy)
            search_x_left = int(cx - self.staff_spacing * 0.3)
            search_y_down_start = int(cy)
            search_y_down_end = min(
                stems.shape[0], int(cy + self.staff_spacing * 2)
            )

            h_s, w_s = stems.shape
            x_r = min(int(search_x_right), w_s - 1)
            if x_r >= 0 and search_y_up_start < search_y_up_end:
                region_ru = stems[
                    search_y_up_start:search_y_up_end, max(0, x_r - 1) : min(w_s, x_r + 2)
                ]
                stem_ru = np.sum(region_ru) / 255 if region_ru.size > 0 else 0
            else:
                stem_ru = 0

            x_l = max(int(search_x_left), 0)
            if x_l < w_s and search_y_down_start < search_y_down_end:
                region_ld = stems[
                    search_y_down_start:search_y_down_end,
                    max(0, x_l - 1) : min(w_s, x_l + 2),
                ]
                stem_ld = np.sum(region_ld) / 255 if region_ld.size > 0 else 0
            else:
                stem_ld = 0

            if stem_ru > stem_ld:
                direction = "up"
            elif stem_ld > stem_ru:
                direction = "down"
            else:
                staff_center = (
                    np.mean([t + b for t, b in self.staff_lines]) / 2
                    if self.staff_lines
                    else cy
                )
                direction = "up" if cy < staff_center else "down"

            classifications.append(direction)

        self.noteheads = noteheads
        self.classifications = classifications
        n_up = sum(1 for c in classifications if c == "up")
        n_down = sum(1 for c in classifications if c == "down")
        log.info(f"Classified: {n_up} stems-up, {n_down} stems-down")
        return True

    def build_erase_images(self) -> Tuple[np.ndarray, np.ndarray]:
        """Build erase-style images using connected component classification."""
        h, w = self.original.shape[:2]
        gray = cv2.cvtColor(self.original, cv2.COLOR_BGR2GRAY)

        binary_no_staff = self.binary.copy()
        for top, bot in self.staff_lines:
            margin = int((bot - top + 1) * 1.2)
            y1 = max(0, top - margin)
            y2 = min(binary_no_staff.shape[0], bot + margin + 1)
            binary_no_staff[y1:y2, :] = 0

        num_features, labeled = cv2.connectedComponents(binary_no_staff)

        up_mask = np.zeros((h, w), dtype=np.uint8)
        down_mask = np.zeros((h, w), dtype=np.uint8)

        for component_id in range(1, num_features + 1):
            comp_mask = labeled == component_id
            comp_y, comp_x = np.where(comp_mask)
            comp_cx, comp_cy = np.mean(comp_x), np.mean(comp_y)

            direction = None

            for notehead, dir_class in zip(self.noteheads, self.classifications):
                if np.any(comp_mask & notehead["mask"]):
                    direction = dir_class
                    break

            if direction is None:
                closest_dist = float("inf")
                for notehead, dir_class in zip(self.noteheads, self.classifications):
                    dist = (
                        (comp_cx - notehead["cx"]) ** 2
                        + (comp_cy - notehead["cy"]) ** 2
                    ) ** 0.5
                    if dist < closest_dist:
                        closest_dist = dist
                        direction = dir_class

            if direction == "up":
                up_mask[comp_mask] = 1
            elif direction == "down":
                down_mask[comp_mask] = 1

        up_img = gray.copy()
        down_img = gray.copy()

        up_img[down_mask > 0] = 255
        down_img[up_mask > 0] = 255

        log.info("Erase-style images built (components classified + proximity)")
        return up_img, down_img

    def redraw_staff_lines(
        self, img: np.ndarray, erased_bboxes: List[Tuple[int, int, int, int]]
    ) -> np.ndarray:
        """Redraw staff lines through erased regions."""
        result = img.copy()
        line_thickness = 1

        for top, bot in self.staff_lines:
            line_row = (top + bot) // 2
            for x_min, y_min, x_max, y_max in erased_bboxes:
                if line_row >= y_min and line_row <= y_max:
                    result[line_row, x_min : x_max + 1] = 0

        return result

    def run_homr(
        self, img: np.ndarray, voice_name: str, variant: str = "base"
    ) -> Optional[Dict]:
        """Run homr on image, return parsed result."""
        img_file = f"{self.output_dir}/hyp_{self.crop_name}_{voice_name}_{variant}.png"
        cv2.imwrite(img_file, img)
        log.info(f"Wrote {img_file}")

        xml_file = img_file.replace(".png", ".musicxml")
        try:
            result = subprocess.run(
                ["./venv/bin/homr", img_file],
                cwd="/Users/mmecoco/Desktop/musical-practice/tools/omr-server",
                capture_output=True,
                text=True,
                timeout=600,
            )
            if result.returncode != 0:
                log.warning(f"homr failed on {img_file}: {result.stderr}")
                return None

            if not os.path.exists(xml_file):
                log.warning(f"homr produced no output for {img_file}")
                return None

            with open(xml_file, "r") as f:
                xml_content = f.read()

            pitched_notes = xml_content.count("<pitch>")
            chord_notes = xml_content.count("<chord>")
            measures = xml_content.count("<measure")

            pitches = []
            import re

            for match in re.finditer(r"<pitch>.*?<step>([A-G])</step>.*?<octave>(\d+)</octave>", xml_content, re.DOTALL):
                step = match.group(1)
                octave = int(match.group(2))
                midi = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[step] + (octave + 1) * 12
                pitches.append(midi)

            mean_midi = np.mean(pitches) if pitches else None

            mean_str = f"{mean_midi:.1f}" if mean_midi is not None else "N/A"
            log.info(
                f"  {voice_name} ({variant}): {pitched_notes} notes, "
                f"mean MIDI {mean_str}, "
                f"{measures} measures"
            )

            return {
                "pitched_notes": pitched_notes,
                "chord_notes": chord_notes,
                "measures": measures,
                "mean_midi": mean_midi,
                "xml_file": xml_file,
            }

        except subprocess.TimeoutExpired:
            log.error(f"homr timeout on {img_file}")
            return None
        except Exception as e:
            log.error(f"Error running homr on {img_file}: {e}")
            return None

    def test_base(self) -> Optional[Dict]:
        """Test base erase-style images."""
        up_img, down_img = self.build_erase_images()

        up_result = self.run_homr(up_img, "up", "base")
        down_result = self.run_homr(down_img, "down", "base")

        if up_result and down_result:
            if (
                up_result["pitched_notes"] >= 1
                and down_result["pitched_notes"] >= 1
            ):
                if (
                    up_result["mean_midi"] is not None
                    and down_result["mean_midi"] is not None
                ):
                    if up_result["mean_midi"] > down_result["mean_midi"]:
                        log.info("SUCCESS: Base erase-style images work!")
                        return {
                            "variant": "base",
                            "up": up_result,
                            "down": down_result,
                        }

        return None

    def test_blur_variant(
        self, up_img: np.ndarray, down_img: np.ndarray
    ) -> Optional[Dict]:
        """Test with Gaussian blur over erased patches."""
        up_blurred = cv2.GaussianBlur(up_img, (5, 5), 1.0)
        down_blurred = cv2.GaussianBlur(down_img, (5, 5), 1.0)

        up_result = self.run_homr(up_blurred, "up", "blur5")
        down_result = self.run_homr(down_blurred, "down", "blur5")

        if up_result and down_result:
            if (
                up_result["pitched_notes"] >= 1
                and down_result["pitched_notes"] >= 1
            ):
                if (
                    up_result["mean_midi"] is not None
                    and down_result["mean_midi"] is not None
                ):
                    if up_result["mean_midi"] > down_result["mean_midi"]:
                        log.info("SUCCESS: Blur variant works!")
                        return {
                            "variant": "blur5",
                            "up": up_result,
                            "down": down_result,
                        }

        return None

    def test_dilation_variant(
        self, up_img: np.ndarray, down_img: np.ndarray
    ) -> Optional[Dict]:
        """Test with dilation of erase mask."""
        up_dilated = cv2.dilate(up_img, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), iterations=1)
        down_dilated = cv2.dilate(
            down_img, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), iterations=1
        )

        up_result = self.run_homr(up_dilated, "up", "dilate1")
        down_result = self.run_homr(down_dilated, "down", "dilate1")

        if up_result and down_result:
            if (
                up_result["pitched_notes"] >= 1
                and down_result["pitched_notes"] >= 1
            ):
                if (
                    up_result["mean_midi"] is not None
                    and down_result["mean_midi"] is not None
                ):
                    if up_result["mean_midi"] > down_result["mean_midi"]:
                        log.info("SUCCESS: Dilation variant works!")
                        return {
                            "variant": "dilate1",
                            "up": up_result,
                            "down": down_result,
                        }

        return None

    def test_inpaint_variant(
        self, up_img_orig: np.ndarray, down_img_orig: np.ndarray
    ) -> Optional[Dict]:
        """Test with inpainting instead of white fill."""
        h, w = self.original.shape[:2]
        gray = cv2.cvtColor(self.original, cv2.COLOR_BGR2GRAY)

        up_mask = np.zeros((h, w), dtype=np.uint8)
        down_mask = np.zeros((h, w), dtype=np.uint8)

        for notehead, direction in zip(self.noteheads, self.classifications):
            if direction == "down":
                up_mask[notehead["mask"]] = 255
            else:
                down_mask[notehead["mask"]] = 255

        up_inpaint = cv2.inpaint(gray, up_mask, 3, cv2.INPAINT_TELEA)
        down_inpaint = cv2.inpaint(gray, down_mask, 3, cv2.INPAINT_TELEA)

        up_result = self.run_homr(up_inpaint, "up", "inpaint")
        down_result = self.run_homr(down_inpaint, "down", "inpaint")

        if up_result and down_result:
            if (
                up_result["pitched_notes"] >= 1
                and down_result["pitched_notes"] >= 1
            ):
                if (
                    up_result["mean_midi"] is not None
                    and down_result["mean_midi"] is not None
                ):
                    if up_result["mean_midi"] > down_result["mean_midi"]:
                        log.info("SUCCESS: Inpaint variant works!")
                        return {
                            "variant": "inpaint",
                            "up": up_result,
                            "down": down_result,
                        }

        return None

    def test_black_erase_variant(
        self, up_img: np.ndarray, down_img: np.ndarray
    ) -> Optional[Dict]:
        """Test with black erasing instead of white fill."""
        up_black = up_img.copy()
        down_black = down_img.copy()

        binary_no_staff = self.binary.copy()
        for top, bot in self.staff_lines:
            margin = int((bot - top + 1) * 1.2)
            y1 = max(0, top - margin)
            y2 = min(binary_no_staff.shape[0], bot + margin + 1)
            binary_no_staff[y1:y2, :] = 0

        num_features, labeled = cv2.connectedComponents(binary_no_staff)

        for component_id in range(1, num_features + 1):
            comp_mask = labeled == component_id
            comp_y, comp_x = np.where(comp_mask)
            comp_cx, comp_cy = np.mean(comp_x), np.mean(comp_y)

            direction = None
            for notehead, dir_class in zip(self.noteheads, self.classifications):
                if np.any(comp_mask & notehead["mask"]):
                    direction = dir_class
                    break

            if direction is None:
                closest_dist = float("inf")
                for notehead, dir_class in zip(self.noteheads, self.classifications):
                    dist = (
                        (comp_cx - notehead["cx"]) ** 2
                        + (comp_cy - notehead["cy"]) ** 2
                    ) ** 0.5
                    if dist < closest_dist:
                        closest_dist = dist
                        direction = dir_class

            if direction == "down":
                up_black[comp_mask] = 0
            elif direction == "up":
                down_black[comp_mask] = 0

        up_result = self.run_homr(up_black, "up", "black")
        down_result = self.run_homr(down_black, "down", "black")

        if up_result and down_result:
            if (
                up_result["pitched_notes"] >= 1
                and down_result["pitched_notes"] >= 1
            ):
                if (
                    up_result["mean_midi"] is not None
                    and down_result["mean_midi"] is not None
                ):
                    if up_result["mean_midi"] > down_result["mean_midi"]:
                        log.info("SUCCESS: Black erase variant works!")
                        return {
                            "variant": "black",
                            "up": up_result,
                            "down": down_result,
                        }

        return None

    def run(self) -> Optional[Dict]:
        """Execute full hypothesis test."""
        log.info(f"=== Testing {self.crop_name} ===")

        if not self.load_and_binarize():
            return None
        if not self.detect_staff_lines():
            return None
        if not self.classify_stems():
            return None

        log.info("Testing variants...")
        result = self.test_base()
        if result:
            return result

        up_img, down_img = self.build_erase_images()

        result = self.test_blur_variant(up_img, down_img)
        if result:
            return result

        result = self.test_dilation_variant(up_img, down_img)
        if result:
            return result

        result = self.test_inpaint_variant(up_img, down_img)
        if result:
            return result

        result = self.test_black_erase_variant(up_img, down_img)
        if result:
            return result

        log.warning(f"All variants failed for {self.crop_name}")
        return None


if __name__ == "__main__":

    output_dir = "/Users/mmecoco/Desktop/musical-practice/tools/omr-server/debug_voicesep"
    crops = [
        (f"{output_dir}/spike_p8_Co-TB_0.png", "spike_p8_Co-TB_0"),
        (f"{output_dir}/spike_p13_Co-SA_0.png", "spike_p13_Co-SA_0"),
    ]

    winning_recipe = None
    for crop_path, crop_name in crops:
        if not os.path.exists(crop_path):
            log.warning(f"Crop not found: {crop_path}")
            continue

        tester = ErasStyleVoiceTest(crop_path, crop_name, output_dir)
        result = tester.run()

        if result:
            log.info(f"WINNING RECIPE: {result['variant']}")
            winning_recipe = result
            break

    if winning_recipe:
        log.info("=== HYPOTHESIS PASSED ===")
        log.info(f"Winning variant: {winning_recipe['variant']}")
        log.info(f"Up voice: {winning_recipe['up']}")
        log.info(f"Down voice: {winning_recipe['down']}")
    else:
        log.info("=== HYPOTHESIS FAILED ===")
