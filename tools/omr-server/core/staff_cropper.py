"""Thin coordinator: extracts vocal staves from sheet music images.

Delegates detection to staff_detector and label assignment to label_ocr.
"""

import logging
from typing import Optional

import cv2
import numpy as np

from core.staff_detector import (
    _binarize,
    _crop_single_staff,
    _detect_staff_line_rows,
    _find_staff_start_x,
    _group_into_staves,
    _group_staff_lines,
    _group_staves_into_systems,
    _select_lead_sheet_vocal_staves,
    _to_gray,
)
from core.label_ocr import _assign_labels_by_position

log = logging.getLogger("staff_cropper")


def _make_x_template(size: int) -> np.ndarray:
    """Create a synthetic × template of the given size."""
    template = np.zeros((size, size), np.uint8)
    thickness = max(1, size // 6)
    cv2.line(template, (0, 0), (size - 1, size - 1), 255, thickness)
    cv2.line(template, (size - 1, 0), (0, size - 1), 255, thickness)
    return template


def _build_staff_mask(binary: np.ndarray) -> np.ndarray:
    """Build a mask that is 255 in staff-line regions, 0 elsewhere."""
    h, w = binary.shape
    h_proj = np.sum(binary, axis=1)
    threshold = w * 0.15

    line_rows = []
    in_line = False
    start = 0
    for i, val in enumerate(h_proj):
        if val > threshold and not in_line:
            in_line = True
            start = i
        elif val <= threshold and in_line:
            in_line = False
            line_rows.append((start + i) // 2)

    if len(line_rows) < 3:
        return np.ones((h, w), dtype=np.uint8) * 255

    gaps = [line_rows[i + 1] - line_rows[i] for i in range(len(line_rows) - 1)]
    small_gaps = sorted([g for g in gaps if 3 < g < 30])
    spacing = small_gaps[len(small_gaps) // 2] if small_gaps else 10

    mask = np.zeros((h, w), dtype=np.uint8)
    margin = int(spacing * 1.5)
    for row in line_rows:
        y1 = max(0, row - margin)
        y2 = min(h, row + margin)
        mask[y1:y2, :] = 255

    return mask


def enhance_for_omr(img: np.ndarray) -> np.ndarray:
    """Enhance a sheet music image for OMR by denoising and sharpening.

    Args:
        img: Input image (BGR 3-channel or grayscale 2D uint8 ndarray).

    Returns:
        Sharpened grayscale uint8 ndarray (2D).
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img.copy()
    denoised = cv2.fastNlMeansDenoising(gray, h=5)
    blurred = cv2.GaussianBlur(denoised, (0, 0), 2.0)
    sharpened = cv2.addWeighted(denoised, 1.5, blurred, -0.5, 0)
    return sharpened


def replace_x_noteheads(img: np.ndarray) -> tuple[np.ndarray, list[int], int]:
    """Detect x-noteheads and replace them with filled round noteheads.

    X-noteheads are used for spoken rhythm and confuse homr. This function
    replaces them with filled ellipses before OMR and returns the x-coordinates
    of replaced X-noteheads (sorted left-to-right) for downstream marking in MusicXML.

    Args:
        img: Input sheet music image (BGR or grayscale).

    Returns:
        Tuple of (processed_image, x_positions, image_width) where:
        - processed_image: Image with X-noteheads replaced by round noteheads
        - x_positions: List of x-coordinates (sorted ascending, left-to-right)
                      of detected X-noteheads in the input image
        - image_width: Width of the input image for coordinate mapping
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img.copy()
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    staff_mask = _build_staff_mask(binary)

    matches = []
    for size in (9, 11, 13):
        template = _make_x_template(size)
        res = cv2.matchTemplate(binary, template, cv2.TM_CCOEFF_NORMED)
        # Raised threshold from 0.4 to 0.5 to filter staff-line noise
        locs = np.where(res >= 0.5)
        for pt_y, pt_x in zip(*locs):
            cx = pt_x + size // 2
            cy = pt_y + size // 2
            if cy < staff_mask.shape[0] and cx < staff_mask.shape[1]:
                if staff_mask[cy, cx] == 0:
                    continue
            matches.append((cx, cy, size, res[pt_y, pt_x]))

    matches.sort(key=lambda m: -m[3])
    kept = []
    # Improved NMS clustering: increased threshold from 10px to 15px
    nms_threshold = 15
    for cx, cy, sz, score in matches:
        if not any(abs(cx - kx) < nms_threshold and abs(cy - ky) < nms_threshold for kx, ky, _, _ in kept):
            kept.append((cx, cy, sz, score))

    result = img.copy()
    x_positions = []
    for cx, cy, sz, score in kept:
        cv2.ellipse(result, (cx, cy), (6, 4), 0, 0, 360, (0, 0, 0), -1)
        x_positions.append(cx)

    # Sort x_positions left-to-right (ascending), not by confidence
    x_positions_sorted = sorted(x_positions)

    image_width = img.shape[1]
    log.info(f"Replaced {len(kept)} x-noteheads with round noteheads at x-coordinates: {x_positions_sorted}")
    return result, x_positions_sorted, image_width


def crop_vocal_staff(img: np.ndarray, padding_factor: float = 1.5) -> Optional[np.ndarray]:
    """Crop the top (vocal) staff from each system and stitch them vertically.

    Args:
        img: Input sheet music image (BGR or grayscale numpy array).
        padding_factor: Padding above/below each staff as a multiple of staff height.

    Returns:
        Stitched image of vocal staves, or None if detection fails.
    """
    gray = _to_gray(img)
    bw = _binarize(gray)
    h, w = gray.shape

    row_mask = _detect_staff_line_rows(bw)
    lines = _group_staff_lines(row_mask)

    if len(lines) < 5:
        log.warning("Too few staff lines detected; returning None")
        return None

    staves = _group_into_staves(lines, h)
    if not staves:
        log.warning("No valid staves detected; returning None")
        return None

    systems = _group_staves_into_systems(staves, h, bw=bw)

    vocal_regions = []
    for sys_idx, system in enumerate(systems):
        top_staff_idx = system[0]
        staff = staves[top_staff_idx]

        staff_top = staff[0][0]
        staff_bottom = staff[-1][1]
        staff_height = staff_bottom - staff_top
        pad = int(staff_height * padding_factor)
        crop_top = max(0, staff_top - pad)
        crop_bottom = min(h, staff_bottom + pad)

        if top_staff_idx + 1 < len(staves) and len(system) > 1:
            next_staff = staves[system[1]]
            midpoint = (staff_bottom + next_staff[0][0]) // 2
            crop_bottom = min(crop_bottom, midpoint)

        if sys_idx > 0:
            prev_last = staves[systems[sys_idx - 1][-1]]
            midpoint = (prev_last[-1][1] + staff_top) // 2
            crop_top = max(crop_top, midpoint)

        vocal_regions.append(img[crop_top:crop_bottom, 0:w])

    if not vocal_regions:
        return None

    separator = np.full(
        (20, w) + ((img.shape[2],) if len(img.shape) == 3 else ()),
        255, dtype=np.uint8,
    )
    parts = []
    for i, region in enumerate(vocal_regions):
        if i > 0:
            parts.append(separator)
        parts.append(region)

    return np.vstack(parts)


def crop_all_vocal_staves(
    img: np.ndarray,
    character_names: list[str] | None = None,
    padding_factor: float = 1.5,
) -> tuple[dict[str, list[tuple[np.ndarray, int]]], list[dict]]:
    """Extract all vocal staves grouped by character name.

    Returns:
        (staves_dict, system_info) where staves_dict maps character name ->
        list of (cropped_image, system_index) tuples.
    """
    if character_names is None:
        character_names = []

    gray = _to_gray(img)
    bw = _binarize(gray)
    h, w = gray.shape

    row_mask = _detect_staff_line_rows(bw)
    lines = _group_staff_lines(row_mask)

    if len(lines) < 5:
        return {}, []

    staves = _group_into_staves(lines, h)
    if not staves:
        return {}, []

    systems = _group_staves_into_systems(staves, h, bw=bw)
    staff_start_x = _find_staff_start_x(bw)
    lead_sheet_staves: set[int] = set()

    try:
        from rapidocr import RapidOCR
        ocr_engine = RapidOCR()
    except ImportError:
        ocr_engine = None
        log.warning("rapidocr not available, using positional fallback")

    result: dict[str, list[tuple[np.ndarray, int]]] = {}
    system_info: list[dict] = []
    known_labels: dict[str, str] = {}

    for sys_idx, system in enumerate(systems):
        assignments = _assign_labels_by_position(
            system, staves, gray, character_names, staff_start_x,
            lead_sheet_staves, ocr_engine=ocr_engine,
        )

        # Fuzzy dedup: normalize OCR label variants to a canonical name
        normalized: dict[int, str] = {}
        for staff_idx, raw_label in assignments.items():
            if raw_label.startswith("Co."):
                known_labels[raw_label.lower().rstrip(".")] = raw_label
                normalized[staff_idx] = raw_label
                continue
            raw_lower = raw_label.lower().rstrip(".")
            matched = False
            for known_lower, canonical in known_labels.items():
                prefix_len = 3
                if (len(raw_lower) >= prefix_len and len(known_lower) >= prefix_len
                        and raw_lower[:prefix_len] == known_lower[:prefix_len]):
                    if len(raw_label) > len(canonical):
                        if canonical in result:
                            result[raw_label] = result.pop(canonical)
                        known_labels[known_lower] = raw_label
                        canonical = raw_label
                    normalized[staff_idx] = canonical
                    matched = True
                    break
            if not matched:
                known_labels[raw_lower] = raw_label
                normalized[staff_idx] = raw_label
        assignments = normalized

        sys_characters: set[str] = set()
        for staff_idx, char_name in assignments.items():
            staff = staves[staff_idx]
            idx_in_system = system.index(staff_idx)

            prev_bottom = None
            next_top = None
            if idx_in_system > 0:
                prev_bottom = staves[system[idx_in_system - 1]][-1][1]
            if idx_in_system < len(system) - 1:
                next_top = staves[system[idx_in_system + 1]][0][0]
            if idx_in_system == 0 and sys_idx > 0:
                prev_bottom = staves[systems[sys_idx - 1][-1]][-1][1]
            if idx_in_system == len(system) - 1 and sys_idx < len(systems) - 1:
                next_top = staves[systems[sys_idx + 1][0]][0][0]

            cropped = _crop_single_staff(img, staff, h, w, staves, staff_idx, prev_bottom, next_top, padding_factor)
            result.setdefault(char_name, []).append((cropped, sys_idx))
            sys_characters.add(char_name)

        system_info.append({
            "system_index": sys_idx,
            "characters": sys_characters,
            "num_staves": len(system),
            "num_vocal_staves": len(assignments),
        })

    # Lead-sheet fallback: no character labels anywhere (e.g. a piano-vocal
    # score where the singer's name sits above the staff, not in the left
    # margin). Treat the top staff of each vocal system as a single "Voice".
    if not result:
        picks = _select_lead_sheet_vocal_staves(systems)
        if picks:
            log.info("No character labels found — lead-sheet mode, extracting %d vocal staves", len(picks))
            system_info = []
            for sys_idx, staff_idx in picks:
                system = systems[sys_idx]
                next_top = staves[system[1]][0][0] if len(system) > 1 else None
                prev_bottom = staves[systems[sys_idx - 1][-1]][-1][1] if sys_idx > 0 else None
                cropped = _crop_single_staff(
                    img, staves[staff_idx], h, w, staves, staff_idx,
                    prev_bottom, next_top, padding_factor,
                )
                result.setdefault("Voice", []).append((cropped, sys_idx))
                system_info.append({
                    "system_index": sys_idx,
                    "characters": {"Voice"},
                    "num_staves": len(system),
                    "num_vocal_staves": 1,
                })

    return result, system_info


def crop_vocal_staff_from_file(input_path: str, output_path: str, **kwargs) -> bool:
    """Read from file, crop vocal staff, write result to file."""
    img = cv2.imread(input_path)
    if img is None:
        log.error(f"Could not read image: {input_path}")
        return False

    result = crop_vocal_staff(img, **kwargs)
    if result is None:
        log.warning("Staff cropping returned None; no output written")
        return False

    cv2.imwrite(output_path, result)
    return True
