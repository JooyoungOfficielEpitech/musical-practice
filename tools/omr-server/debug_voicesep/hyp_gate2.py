#!/usr/bin/env python3
"""
Hypothesis gate attempt 2: erase-from-original with proper staff-line preservation.

Key fixes from attempt 1:
1. Build note-component mask = binary MINUS staff-line rows (not before redraw)
2. Classify components via spike classifier (up/down by stem direction)
3. up_img = original grayscale with ONLY down-voice component pixels whited
4. down_img = same with up-voice pixels whited
5. Redraw staff lines through erased bboxes (ACTUALLY CALL THIS)
6. Visual verification loop: check up_img and down_img before homr
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


class HypGate2:
    """Erase-from-original voice separation test."""

    def __init__(self, crop_path: str, crop_name: str, output_dir: str = "."):
        self.crop_path = crop_path
        self.crop_name = crop_name
        self.output_dir = output_dir
        self.original = None
        self.gray = None
        self.binary = None
        self.staff_lines = None
        self.staff_spacing = None
        self.noteheads = None
        self.classifications = None
        self.visual_iterations = 0

    def load_and_binarize(self) -> bool:
        """Load original, convert to grayscale, binarize (Otsu inv)."""
        self.original = cv2.imread(self.crop_path)
        if self.original is None:
            log.error(f"Failed to load {self.crop_path}")
            return False

        self.gray = cv2.cvtColor(self.original, cv2.COLOR_BGR2GRAY)
        _, self.binary = cv2.threshold(
            self.gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )
        log.info(f"Loaded {self.crop_path}: {self.original.shape}")
        return True

    def detect_staff_lines(self) -> bool:
        """Detect staff line rows using horizontal morphology."""
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

    def build_note_component_mask(self) -> np.ndarray:
        """
        Build note-component mask = binary minus staff-line rows.
        Returns mask with only note-related pixels (stems, noteheads, beams).
        """
        binary_no_staff = self.binary.copy()
        for top, bot in self.staff_lines:
            margin = int((bot - top + 1) * 1.2)
            y1 = max(0, top - margin)
            y2 = min(binary_no_staff.shape[0], bot + margin + 1)
            binary_no_staff[y1:y2, :] = 0
        return binary_no_staff

    def find_stems(self, binary_no_staff: np.ndarray) -> np.ndarray:
        """Find stems as vertical strokes via morphological opening."""
        kernel_height = int(self.staff_spacing * 1.8)
        kernel_height = max(3, kernel_height)
        v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, kernel_height))
        stems = cv2.morphologyEx(binary_no_staff, cv2.MORPH_OPEN, v_kernel)
        return stems

    def find_noteheads(self, binary_no_staff: np.ndarray) -> List[Dict]:
        """Find noteheads as connected components with size/shape filters."""
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
            noteheads.append({
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
            })

        return noteheads

    def classify_noteheads(self, stems: np.ndarray) -> List[str]:
        """Classify each notehead as up/down via stem direction (spike logic)."""
        classifications = []

        for notehead in self.noteheads:
            cx, cy = notehead["cx"], notehead["cy"]
            search_x_right = int(cx + self.staff_spacing * 0.3)
            search_y_up_start = max(0, int(cy - self.staff_spacing * 2))
            search_y_up_end = int(cy)
            search_x_left = int(cx - self.staff_spacing * 0.3)
            search_y_down_start = int(cy)
            search_y_down_end = min(stems.shape[0], int(cy + self.staff_spacing * 2))

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

        n_up = sum(1 for c in classifications if c == "up")
        n_down = sum(1 for c in classifications if c == "down")
        log.info(f"Classified noteheads: {n_up} up, {n_down} down")
        return classifications

    def classify_components(
        self, binary_no_staff: np.ndarray, stems: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray, List[Tuple[int, int, int, int]]]:
        """
        Classify all connected components by assigning to nearest notehead.
        Returns: up_mask, down_mask, erased_bboxes.
        """
        num_features, labeled = cv2.connectedComponents(binary_no_staff)
        h, w = binary_no_staff.shape
        up_mask = np.zeros((h, w), dtype=np.uint8)
        down_mask = np.zeros((h, w), dtype=np.uint8)
        erased_bboxes = []

        for comp_id in range(1, num_features + 1):
            comp_mask = labeled == comp_id
            comp_y, comp_x = np.where(comp_mask)

            if len(comp_y) == 0:
                continue

            comp_cx = np.mean(comp_x)
            comp_cy = np.mean(comp_y)

            direction = None

            for notehead, dirclass in zip(self.noteheads, self.classifications):
                if np.any(comp_mask & notehead["mask"]):
                    direction = dirclass
                    break

            if direction is None:
                closest_dist = float("inf")
                for notehead, dirclass in zip(self.noteheads, self.classifications):
                    dist = (
                        (comp_cx - notehead["cx"]) ** 2
                        + (comp_cy - notehead["cy"]) ** 2
                    ) ** 0.5
                    if dist < closest_dist:
                        closest_dist = dist
                        direction = dirclass

            if direction == "up":
                up_mask[comp_mask] = 1
                erased_bboxes.append((comp_y.min(), comp_x.min(), comp_y.max(), comp_x.max()))
            elif direction == "down":
                down_mask[comp_mask] = 1
                erased_bboxes.append((comp_y.min(), comp_x.min(), comp_y.max(), comp_x.max()))

        return up_mask, down_mask, erased_bboxes

    def build_erase_images(self) -> Tuple[np.ndarray, np.ndarray]:
        """
        Build erase-style images from original grayscale.
        up_img = original with down-voice component pixels whited
        down_img = original with up-voice component pixels whited
        """
        binary_no_staff = self.build_note_component_mask()
        stems = self.find_stems(binary_no_staff)
        self.noteheads = self.find_noteheads(binary_no_staff)

        if not self.noteheads:
            log.error("No noteheads found")
            return None, None

        self.classifications = self.classify_noteheads(stems)
        up_mask, down_mask, erased_bboxes = self.classify_components(
            binary_no_staff, stems
        )

        up_img = self.gray.copy()
        down_img = self.gray.copy()

        up_img[down_mask > 0] = 255
        down_img[up_mask > 0] = 255

        up_img = self.redraw_staff_lines(up_img, erased_bboxes)
        down_img = self.redraw_staff_lines(down_img, erased_bboxes)

        log.info("Built erase-style images")
        return up_img, down_img

    def redraw_staff_lines(
        self, img: np.ndarray, erased_bboxes: List[Tuple[int, int, int, int]]
    ) -> np.ndarray:
        """Redraw staff lines through erased regions (thin black lines)."""
        result = img.copy()
        line_thickness = 1

        for top, bot in self.staff_lines:
            line_row = (top + bot) // 2
            for y_min, x_min, y_max, x_max in erased_bboxes:
                if line_row >= y_min and line_row <= y_max:
                    result[line_row, x_min : x_max + 1] = 0

        return result

    def run_homr(self, img: np.ndarray, voice_name: str, variant: str = "base") -> Optional[Dict]:
        """Run homr on image, return parsed result."""
        img_file = f"{self.output_dir}/hyp2_{self.crop_name}_{voice_name}_{variant}.png"
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
                log.warning(f"homr failed: {result.stderr}")
                return None

            if not os.path.exists(xml_file):
                log.warning("homr produced no output")
                return None

            with open(xml_file, "r") as f:
                xml_content = f.read()

            pitched_notes = xml_content.count("<pitch>")
            measures = xml_content.count("<measure")

            pitches = []
            import re

            for match in re.finditer(
                r"<pitch>.*?<step>([A-G])</step>.*?<octave>(\d+)</octave>",
                xml_content,
                re.DOTALL,
            ):
                step = match.group(1)
                octave = int(match.group(2))
                midi = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[
                    step
                ] + (octave + 1) * 12
                pitches.append(midi)

            mean_midi = np.mean(pitches) if pitches else None

            mean_str = f"{mean_midi:.1f}" if mean_midi is not None else "N/A"
            log.info(
                f"  {voice_name} ({variant}): {pitched_notes} notes, "
                f"mean MIDI {mean_str}, {measures} measures"
            )

            return {
                "pitched_notes": pitched_notes,
                "measures": measures,
                "mean_midi": mean_midi,
                "pitches": pitches,
                "xml_file": xml_file,
            }

        except subprocess.TimeoutExpired:
            log.error("homr timeout")
            return None
        except Exception as e:
            log.error(f"Error: {e}")
            return None

    def test_base(self) -> Optional[Dict]:
        """Test base erase-style images."""
        up_img, down_img = self.build_erase_images()
        if up_img is None or down_img is None:
            return None

        self.visual_iterations += 1
        log.info(f"Visual iteration {self.visual_iterations}: running homr on base variant")

        up_result = self.run_homr(up_img, "up", "base")
        down_result = self.run_homr(down_img, "down", "base")

        if not up_result or not down_result:
            return None

        if up_result["pitched_notes"] < 1 or down_result["pitched_notes"] < 1:
            return None

        if (
            up_result["mean_midi"] is not None
            and down_result["mean_midi"] is not None
            and up_result["mean_midi"] > down_result["mean_midi"]
        ):
            log.info("SUCCESS: Base variant passed!")
            return {
                "variant": "base",
                "up": up_result,
                "down": down_result,
                "iterations": self.visual_iterations,
            }

        return None

    def test_blur_variant(self, up_img: np.ndarray, down_img: np.ndarray) -> Optional[Dict]:
        """Test with Gaussian blur over erased regions."""
        up_blurred = cv2.GaussianBlur(up_img, (5, 5), 1.0)
        down_blurred = cv2.GaussianBlur(down_img, (5, 5), 1.0)

        self.visual_iterations += 1
        log.info(f"Visual iteration {self.visual_iterations}: testing blur variant")

        up_result = self.run_homr(up_blurred, "up", "blur5")
        down_result = self.run_homr(down_blurred, "down", "blur5")

        if not up_result or not down_result:
            return None

        if up_result["pitched_notes"] < 1 or down_result["pitched_notes"] < 1:
            return None

        if (
            up_result["mean_midi"] is not None
            and down_result["mean_midi"] is not None
            and up_result["mean_midi"] > down_result["mean_midi"]
        ):
            log.info("SUCCESS: Blur variant passed!")
            return {
                "variant": "blur5",
                "up": up_result,
                "down": down_result,
                "iterations": self.visual_iterations,
            }

        return None

    def test_inpaint_variant(self, up_img_gray: np.ndarray, down_img_gray: np.ndarray) -> Optional[Dict]:
        """Test with inpainting instead of white fill."""
        binary_no_staff = self.build_note_component_mask()
        up_mask = np.zeros_like(self.gray, dtype=np.uint8)
        down_mask = np.zeros_like(self.gray, dtype=np.uint8)

        for notehead, direction in zip(self.noteheads, self.classifications):
            if direction == "down":
                up_mask[notehead["mask"]] = 255
            else:
                down_mask[notehead["mask"]] = 255

        up_inpaint = cv2.inpaint(self.gray, up_mask, 3, cv2.INPAINT_TELEA)
        down_inpaint = cv2.inpaint(self.gray, down_mask, 3, cv2.INPAINT_TELEA)

        self.visual_iterations += 1
        log.info(f"Visual iteration {self.visual_iterations}: testing inpaint variant")

        up_result = self.run_homr(up_inpaint, "up", "inpaint")
        down_result = self.run_homr(down_inpaint, "down", "inpaint")

        if not up_result or not down_result:
            return None

        if up_result["pitched_notes"] < 1 or down_result["pitched_notes"] < 1:
            return None

        if (
            up_result["mean_midi"] is not None
            and down_result["mean_midi"] is not None
            and up_result["mean_midi"] > down_result["mean_midi"]
        ):
            log.info("SUCCESS: Inpaint variant passed!")
            return {
                "variant": "inpaint",
                "up": up_result,
                "down": down_result,
                "iterations": self.visual_iterations,
            }

        return None

    def run(self) -> Optional[Dict]:
        """Execute full hypothesis test."""
        log.info(f"=== Testing {self.crop_name} ===")

        if not self.load_and_binarize():
            return None
        if not self.detect_staff_lines():
            return None

        result = self.test_base()
        if result:
            return result

        up_img, down_img = self.build_erase_images()
        if up_img is None or down_img is None:
            return None

        result = self.test_blur_variant(up_img, down_img)
        if result:
            return result

        result = self.test_inpaint_variant(self.gray, self.gray)
        if result:
            return result

        log.warning("All variants failed")
        return None


if __name__ == "__main__":
    output_dir = "/Users/mmecoco/Desktop/musical-practice/tools/omr-server/debug_voicesep"
    crops = [
        (f"{output_dir}/spike_p8_Co-TB_0.png", "spike_p8_Co-TB_0"),
        (f"{output_dir}/spike_p8_Co-SA_0.png", "spike_p8_Co-SA_0"),
    ]

    winning_recipe = None
    for crop_path, crop_name in crops:
        if not os.path.exists(crop_path):
            log.warning(f"Crop not found: {crop_path}")
            continue

        tester = HypGate2(crop_path, crop_name, output_dir)
        result = tester.run()

        if result:
            log.info("=== WINNING RECIPE ===")
            log.info(f"Variant: {result['variant']}")
            log.info(f"Visual iterations: {result['iterations']}")
            log.info(f"Up: {result['up']['pitched_notes']} notes, mean MIDI {result['up']['mean_midi']}")
            log.info(f"Down: {result['down']['pitched_notes']} notes, mean MIDI {result['down']['mean_midi']}")
            winning_recipe = result
            break

    if not winning_recipe:
        log.info("=== HYPOTHESIS FAILED ===")
