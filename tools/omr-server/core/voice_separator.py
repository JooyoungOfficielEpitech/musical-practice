"""Separate shared staves into up/down voice images by stem direction.

Produces two erase-from-original images: each keeps the full original
grayscale (staff lines, clef, signatures, lyrics, ambiguous content) and
white-fills only the note components confidently classified as the OTHER
voice. Ambiguous content stays in both — downstream chord-splitting assigns
shared chords, and unison is musically safer duplicated than deleted.

X-noteheads (unpitched spoken content) are detected and preserved in both
voice images, as they are ambiguous/non-directional.
"""

from dataclasses import dataclass
import logging

import cv2
import numpy as np

from core.staff_detector import (
    _binarize,
    _detect_staff_line_rows,
    _find_staff_start_x,
    _group_staff_lines,
    _to_gray,
)
from core.voice_classifier import classify_component, pair_stemless

log = logging.getLogger("voice_separator")

MIN_DIRECTED_PER_VOICE = 2   # need ≥ this many stem votes in EACH direction
MAX_ONE_DIRECTION_PCT = 0.85  # beyond this it's effectively monophonic
MIN_COMPONENT_PIXELS = 6
SIGNATURE_REGION_SS = 6.0    # clef/key/time region width after staff start
X_NOTEHEAD_TEMPLATE_SIZES = (8, 9, 10, 11, 12, 13, 14, 15)
X_NOTEHEAD_MATCH_THRESHOLD = 0.49  # calibrated threshold for x-notehead detection
X_NOTEHEAD_NMS_THRESHOLD = 12      # min spacing between detected x-noteheads


@dataclass
class SeparationResult:
    """Result of voice separation on one staff image."""

    up_img: np.ndarray
    down_img: np.ndarray
    n_up: int
    n_down: int
    n_ambiguous: int


def _remove_staff_lines(binary: np.ndarray, lines: list[tuple[int, int]]) -> np.ndarray:
    """Zero out staff-line rows (tight margin), then re-bridge cut noteheads."""
    result = binary.copy()
    for top, bot in lines:
        y1 = max(0, top - 1)
        y2 = min(result.shape[0], bot + 2)
        result[y1:y2, :] = 0
    return result


def _rebridge(binary_no_staff: np.ndarray, staff_spacing: float) -> np.ndarray:
    """Vertically close small gaps left by staff-line removal."""
    k = max(3, int(0.6 * staff_spacing))
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, k))
    return cv2.morphologyEx(binary_no_staff, cv2.MORPH_CLOSE, kernel)


def _find_stems(binary: np.ndarray, staff_spacing: float) -> np.ndarray:
    """Detect stems on the ORIGINAL binary — vertical runs survive staff lines."""
    kernel_height = max(3, int(staff_spacing * 1.8))
    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, kernel_height))
    return cv2.morphologyEx(binary, cv2.MORPH_OPEN, v_kernel)


def _find_beams(binary_no_staff: np.ndarray, staff_spacing: float) -> np.ndarray:
    """Detect beams: wide horizontal strokes thicker than staff lines."""
    k_w = max(5, int(1.6 * staff_spacing))
    k_h = max(2, int(0.22 * staff_spacing))
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_w, k_h))
    return cv2.morphologyEx(binary_no_staff, cv2.MORPH_OPEN, kernel)


def _make_x_template(size: int) -> np.ndarray:
    """Create a synthetic × template for x-notehead detection.

    Returns a binary template with white X lines on black background,
    matching the style used in staff_cropper.
    """
    template = np.zeros((size, size), dtype=np.uint8)
    thickness = max(1, size // 6)
    cv2.line(template, (0, 0), (size - 1, size - 1), 255, thickness)
    cv2.line(template, (size - 1, 0), (0, size - 1), 255, thickness)
    return template


def _detect_x_notehead_regions(binary: np.ndarray) -> np.ndarray:
    """Detect x-notehead regions using template matching.

    Returns a binary mask where x-notehead pixels are marked 255 (white).
    Uses multiple template sizes and NMS to find x-shaped note heads.
    """
    mask = np.zeros(binary.shape, dtype=np.uint8)
    matches = []

    # Template matching across multiple sizes
    for size in X_NOTEHEAD_TEMPLATE_SIZES:
        template = _make_x_template(size)
        res = cv2.matchTemplate(binary, template, cv2.TM_CCOEFF_NORMED)
        locs = np.where(res >= X_NOTEHEAD_MATCH_THRESHOLD)
        for pt_y, pt_x in zip(*locs):
            cx = pt_x + size // 2
            cy = pt_y + size // 2
            matches.append((cx, cy, size, res[pt_y, pt_x]))

    # Non-maximum suppression
    if not matches:
        return mask

    matches.sort(key=lambda m: -m[3])
    kept = []
    for cx, cy, sz, score in matches:
        if not any(
            abs(cx - kx) < X_NOTEHEAD_NMS_THRESHOLD
            and abs(cy - ky) < X_NOTEHEAD_NMS_THRESHOLD
            for kx, ky, _, _ in kept
        ):
            kept.append((cx, cy, sz, score))

    # Mark detected x-notehead centers in mask with generous radius
    # to capture the full x-notehead and any attached stem/ledger lines
    for cx, cy, sz, _ in kept:
        # Radius = sz + buffer to ensure full notehead coverage
        radius = max(sz // 2 + 6, int(sz * 0.8))
        cv2.circle(mask, (cx, cy), radius, 255, -1)

    log.info(f"Detected {len(kept)} x-notehead regions")
    return mask


def _extract_component_info(labeled: np.ndarray, label_id: int) -> dict | None:
    mask = labeled == label_id
    y, x = np.where(mask)
    if len(y) < MIN_COMPONENT_PIXELS:
        return None
    y_min, y_max = int(y.min()), int(y.max())
    x_min, x_max = int(x.min()), int(x.max())
    return {
        "label": label_id,
        "mask": mask,
        "cx": (x_min + x_max) / 2,
        "cy": (y_min + y_max) / 2,
        "y_min": y_min,
        "y_max": y_max,
        "x_min": x_min,
        "x_max": x_max,
        "h": y_max - y_min + 1,
        "w": x_max - x_min + 1,
    }


def _build_voice_images(
    original_gray: np.ndarray,
    components: list[dict],
    classifications: list[str],
    staff_lines: list[tuple[int, int]],
    staff_spacing: float,
    x_notehead_mask: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """White-fill ONLY the opposite directed voice; ambiguous and x-noteheads stay in both.

    Component masks come from the staff-line-removed binary, so they are
    vertically dilated to also cover the note's slice across line bands.
    Staff lines are then redrawn through the erased regions.

    X-notehead regions (if provided) are never erased from either voice image.
    """
    h, w = original_gray.shape
    up_erase = np.zeros((h, w), dtype=np.uint8)
    down_erase = np.zeros((h, w), dtype=np.uint8)
    for component, direction in zip(components, classifications):
        if direction == "down":
            up_erase[component["mask"]] = 255
        elif direction == "up":
            down_erase[component["mask"]] = 255

    k = max(3, int(0.8 * staff_spacing))
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, k))
    up_erase = cv2.dilate(up_erase, kernel) > 0
    down_erase = cv2.dilate(down_erase, kernel) > 0

    # X-noteheads are ambiguous (unpitched) — never erase them from either image
    if x_notehead_mask is not None:
        x_region = x_notehead_mask > 0
        up_erase = np.logical_and(up_erase, ~x_region)
        down_erase = np.logical_and(down_erase, ~x_region)

    up_img = original_gray.copy()
    down_img = original_gray.copy()
    up_img[up_erase] = 255
    down_img[down_erase] = 255

    # Redraw staff-line segments through erased regions so lines stay continuous.
    for top, bot in staff_lines:
        y1, y2 = max(0, top), min(h, bot + 1)
        up_img[y1:y2, :][up_erase[y1:y2, :]] = 0
        down_img[y1:y2, :][down_erase[y1:y2, :]] = 0

    return up_img, down_img


def separate_voices_image(img: np.ndarray) -> SeparationResult | None:
    """Separate a shared staff into up/down voice images by stem direction.

    Returns None when separation is not viable — too few staff lines, fewer
    than MIN_DIRECTED_PER_VOICE confidently classified components per voice,
    or effectively monophonic content. Callers then fall back to the merged
    single-pass path, which is the correct behavior for chord-style or
    single-voice passages.
    """
    gray = _to_gray(img)
    binary = _binarize(gray)

    row_mask = _detect_staff_line_rows(binary)
    lines = _group_staff_lines(row_mask)
    if len(lines) < 3:
        log.info("Too few staff lines detected; skipping separation")
        return None

    line_centers = [(t + b) / 2 for t, b in lines]
    gaps = [line_centers[i + 1] - line_centers[i] for i in range(len(line_centers) - 1)]
    plausible = sorted(g for g in gaps if 3 < g < 60)
    staff_spacing = float(plausible[len(plausible) // 2]) if plausible else 10.0
    staff_band = (float(lines[0][0]), float(lines[-1][1]))

    stems = _find_stems(binary, staff_spacing)
    binary_no_staff = _rebridge(_remove_staff_lines(binary, lines), staff_spacing)
    beams = _find_beams(binary_no_staff, staff_spacing)
    note_ink = binary_no_staff.copy()
    note_ink[stems > 0] = 0
    note_ink[beams > 0] = 0

    num_features, labeled = cv2.connectedComponents(binary_no_staff)

    # Clef/key/time signatures live left of this x — always shared (ambiguous).
    signature_x_end = _find_staff_start_x(binary) + SIGNATURE_REGION_SS * staff_spacing

    components: list[dict] = []
    classifications: list[str] = []
    vote_weights: list[int] = []
    for label_id in range(1, num_features):
        info = _extract_component_info(labeled, label_id)
        if info is None:
            continue
        if info["x_max"] <= signature_x_end:
            direction, votes = "ambiguous", 0
        else:
            direction, votes = classify_component(
                info, stems, note_ink, staff_spacing, staff_band
            )
        components.append(info)
        classifications.append(direction)
        vote_weights.append(votes)

    classifications = pair_stemless(components, classifications, staff_spacing, staff_band)

    # Weight by stem votes (a beamed group is one component but many notes);
    # stemless paired whole notes count as one vote each.
    n_up = sum(
        max(w, 1) for c, w in zip(classifications, vote_weights) if c == "up"
    )
    n_down = sum(
        max(w, 1) for c, w in zip(classifications, vote_weights) if c == "down"
    )
    n_ambiguous = sum(1 for c in classifications if c == "ambiguous")

    if n_up < MIN_DIRECTED_PER_VOICE or n_down < MIN_DIRECTED_PER_VOICE:
        log.info(
            f"Not enough directed notes (up={n_up}, down={n_down}); skipping separation"
        )
        return None

    max_pct = max(n_up, n_down) / (n_up + n_down)
    if max_pct > MAX_ONE_DIRECTION_PCT:
        log.info(
            f"Likely monophonic: {n_up} up, {n_down} down ({max_pct:.0%}); skipping"
        )
        return None

    # Detect x-notehead regions (unpitched spoken content) to preserve in both images
    x_notehead_mask = _detect_x_notehead_regions(binary)

    up_img, down_img = _build_voice_images(
        gray, components, classifications, lines, staff_spacing, x_notehead_mask
    )
    log.info(f"Separated: {n_up} up, {n_down} down, {n_ambiguous} ambiguous")

    return SeparationResult(
        up_img=up_img,
        down_img=down_img,
        n_up=n_up,
        n_down=n_down,
        n_ambiguous=n_ambiguous,
    )
