"""Detect staff lines, group into staves, and group staves into systems."""

import logging

import cv2
import numpy as np

log = logging.getLogger("staff_detector")


def _to_gray(img: np.ndarray) -> np.ndarray:
    """Convert BGR image to grayscale; pass through if already grayscale."""
    if len(img.shape) == 3:
        return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return img


def _binarize(gray: np.ndarray) -> np.ndarray:
    """Binarize so staff lines are black (0) on white (255)."""
    _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return bw


def _detect_staff_line_rows(bw: np.ndarray) -> np.ndarray:
    """Return a 1D binary mask where 1 = row contains a staff line.

    Uses horizontal morphological opening to isolate long horizontal runs.
    """
    h, w = bw.shape
    kernel_width = max(w // 4, 100)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_width, 1))
    horiz = cv2.morphologyEx(bw, cv2.MORPH_OPEN, kernel)
    row_sums = np.sum(horiz, axis=1) / 255
    threshold = w * 0.15
    return (row_sums > threshold).astype(np.uint8)


def _group_staff_lines(row_mask: np.ndarray, min_line_gap: int = 3) -> list[tuple[int, int]]:
    """Group contiguous staff-line rows into individual line bands.

    Returns list of (top_row, bottom_row) for each detected line.
    """
    lines = []
    in_line = False
    start = 0
    for i, val in enumerate(row_mask):
        if val and not in_line:
            start = i
            in_line = True
        elif not val and in_line:
            lines.append((start, i - 1))
            in_line = False
    if in_line:
        lines.append((start, len(row_mask) - 1))

    if not lines:
        return []
    merged = [lines[0]]
    for top, bot in lines[1:]:
        prev_top, prev_bot = merged[-1]
        if top - prev_bot <= min_line_gap:
            merged[-1] = (prev_top, bot)
        else:
            merged.append((top, bot))
    return merged


def _group_into_staves(
    lines: list[tuple[int, int]], img_height: int
) -> list[list[tuple[int, int]]]:
    """Group individual detected lines into staves (each staff ≈ 5 lines).

    Uses adaptive gap analysis: intra-staff gaps are small and consistent;
    inter-staff gaps are larger.
    """
    if len(lines) < 5:
        return []

    centers = [(t + b) / 2 for t, b in lines]
    gaps = [centers[i + 1] - centers[i] for i in range(len(centers) - 1)]

    sorted_gaps = sorted(gaps)
    n_intra = max(1, len(sorted_gaps) * 2 // 3)
    intra_staff_gap = np.median(sorted_gaps[:n_intra])
    staff_break_threshold = intra_staff_gap * 2.2

    staves: list[list[tuple[int, int]]] = []
    current_staff = [lines[0]]
    for i in range(len(gaps)):
        if gaps[i] > staff_break_threshold:
            staves.append(current_staff)
            current_staff = [lines[i + 1]]
        else:
            current_staff.append(lines[i + 1])
    if current_staff:
        staves.append(current_staff)

    valid_staves = []
    for staff in staves:
        if 4 <= len(staff) <= 6:
            valid_staves.append(staff)
        elif len(staff) > 6:
            for j in range(0, len(staff), 5):
                chunk = staff[j:j + 5]
                if len(chunk) >= 4:
                    valid_staves.append(chunk)

    return valid_staves


def _find_staff_start_x(bw: np.ndarray) -> int:
    """Find the x-coordinate where staff lines begin (leftmost edge)."""
    h, w = bw.shape
    kernel_w = max(w // 4, 100)
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_w, 1))
    horiz = cv2.morphologyEx(bw, cv2.MORPH_OPEN, h_kernel)
    col_sums = np.sum(horiz, axis=0) / 255
    for x in range(len(col_sums)):
        if col_sums[x] > 20:
            return x
    return 0


def _check_barline_connectivity(
    bw: np.ndarray,
    staves: list[list[tuple[int, int]]],
    staff_start_x: int,
) -> list[bool]:
    """Check whether consecutive staves are connected by a vertical barline.

    Returns a list of booleans per consecutive stave pair.
    True = connected (same system), False = break (different systems).
    """
    if len(staves) < 2:
        return []

    barline_region = bw[:, max(0, staff_start_x - 5):staff_start_x + 10]
    col_proj = np.max(barline_region, axis=1)

    connected = []
    for i in range(len(staves) - 1):
        bot = staves[i][-1][1]
        top = staves[i + 1][0][0]
        gap_region = col_proj[bot:top]
        ink_ratio = np.sum(gap_region > 0) / max(len(gap_region), 1)
        connected.append(ink_ratio > 0.5)

    return connected


def _crop_single_staff(
    img: np.ndarray,
    staff: list[tuple[int, int]],
    h: int,
    w: int,
    staves: list[list[tuple[int, int]]],
    staff_idx: int,
    prev_staff_bottom: int | None,
    next_staff_top: int | None,
    padding_factor: float = 1.5,
) -> np.ndarray:
    """Crop a single staff region from the image with padding, avoiding neighbour overlap."""
    staff_top = staff[0][0]
    staff_bottom = staff[-1][1]
    staff_height = staff_bottom - staff_top

    pad = int(staff_height * padding_factor)
    crop_top = max(0, staff_top - pad)
    crop_bottom = min(h, staff_bottom + pad)

    if prev_staff_bottom is not None:
        midpoint = (prev_staff_bottom + staff_top) // 2
        crop_top = max(crop_top, midpoint)

    if next_staff_top is not None:
        midpoint = (staff_bottom + next_staff_top) // 2
        crop_bottom = min(crop_bottom, midpoint)

    return img[crop_top:crop_bottom, 0:w]


def _group_staves_into_systems(
    staves: list[list[tuple[int, int]]],
    img_height: int,
    bw: np.ndarray | None = None,
) -> list[list[int]]:
    """Group staves into systems using barline connectivity or gap heuristic.

    Returns list of systems; each system is a list of stave indices.
    """
    if not staves:
        return []
    if len(staves) == 1:
        return [[0]]

    if bw is not None:
        staff_start_x = _find_staff_start_x(bw)
        connectivity = _check_barline_connectivity(bw, staves, staff_start_x)
        log.info(f"Barline connectivity (x={staff_start_x}): {connectivity}")

        if any(connectivity):
            connected_groups: list[list[int]] = []
            current_group: list[int] = []
            for i, is_connected in enumerate(connectivity):
                if is_connected:
                    if not current_group:
                        current_group = [i]
                    current_group.append(i + 1)
                else:
                    if current_group:
                        connected_groups.append(current_group)
                        current_group = []
            if current_group:
                connected_groups.append(current_group)

            if connected_groups:
                first_connected = connected_groups[0][0]
                systems: list[list[int]] = []
                if first_connected > 0:
                    systems.append(list(range(first_connected)))
                for group in connected_groups:
                    systems.append(group)
                if len(systems) >= 2:
                    log.info(f"Barline-based systems: {[len(s) for s in systems]}")
                    return systems

    # Fallback: gap-based detection
    staff_centers = [np.mean([r for t, b in staff for r in (t, b)]) for staff in staves]
    staff_gaps = [staff_centers[i + 1] - staff_centers[i] for i in range(len(staff_centers) - 1)]

    if not staff_gaps:
        return [[0]]

    median_gap = np.median(sorted(staff_gaps))
    system_break_threshold = median_gap * 1.5

    systems = []
    current_system = [0]
    for i, gap in enumerate(staff_gaps):
        if gap > system_break_threshold:
            systems.append(current_system)
            current_system = [i + 1]
        else:
            current_system.append(i + 1)
    if current_system:
        systems.append(current_system)

    return systems
