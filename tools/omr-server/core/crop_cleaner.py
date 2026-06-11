"""Strip out-of-staff contamination from staff crops before OMR.

Vocal-score crops carry noise outside the staff band: clap-rhythm x-notehead
lines floating above the staff (homr reads them as high pitched notes) and
neighbouring staves' rests/notes bleeding in below. Both sit FULLY outside
the staff band, while every real element of this staff — ledger-line notes,
hanging stems, beams — has a connected component that reaches into the band
(diagnosis 2026-06-11: claps ≥ 2 staff-spaces above staff_top on all pages,
real notes never fully outside).

Rule: erase a component when it ORIGINATES well outside the band (≥ 2 staff
spaces away) AND never reaches the staff vicinity. Clap heads with hanging
stems satisfy both; ledger-line notes fail the second test (their stems reach
into the staff) and isolated ledger heads fail the first (they start close).
"""

import logging

import cv2
import numpy as np

from core.staff_detector import (
    _binarize,
    _detect_staff_line_rows,
    _group_staff_lines,
    _to_gray,
)

log = logging.getLogger("crop_cleaner")

FAR_ABOVE_SS = 2.0    # component must start at least this far above the staff
FAR_BELOW_SS = 2.5    # ... or this far below
NEAR_BAND_SS = 0.4    # and must never come closer to the staff than this
X_MATCH_THRESHOLD = 0.4


def _erase_above_staff_claps(
    gray: np.ndarray, binary: np.ndarray, staff_top: int, ss: float
) -> int:
    """Erase x-shaped clap heads above the staff whose stems touch it.

    Stems touching a staff line merge the clap into the staff-line mega
    component, evading the component rule — locate the x heads by template
    instead and clear their column above the staff. In-staff x-noteheads
    (spoken rhythm) have centers inside the band and are untouched.
    """
    from core.staff_cropper import _make_x_template

    h, w = gray.shape
    # An x-head whose CENTER sits above the top line is clap-lane material —
    # real x-notehead content lies on/within the staff.
    cutoff = staff_top - 0.2 * ss
    erased_cols: list[tuple[int, int]] = []
    for size in (int(0.8 * ss), int(ss), int(1.2 * ss)):
        if size < 5 or size >= h:
            continue
        template = _make_x_template(size)
        res = cv2.matchTemplate(binary, template, cv2.TM_CCOEFF_NORMED)
        ys, xs = np.where(res >= X_MATCH_THRESHOLD)
        for py, px in zip(ys, xs):
            cy, cx = py + size // 2, px + size // 2
            if cy >= cutoff:
                continue
            if any(abs(cx - ex) < ss for ex, _ in erased_cols):
                continue
            half = int(0.9 * ss)
            x1, x2 = max(0, cx - half), min(w, cx + half + 1)
            gray[0:max(0, staff_top - 1), x1:x2] = 255
            erased_cols.append((cx, cy))
    return len(erased_cols)


def strip_outside_staff(img: np.ndarray) -> np.ndarray:
    """Return a grayscale copy with fully-out-of-band components whited out.

    Returns the (grayscale) image unchanged when staff detection fails —
    never destructive without a confident staff band.
    """
    gray = _to_gray(img).copy()
    binary = _binarize(gray)

    lines = _group_staff_lines(_detect_staff_line_rows(binary))
    if len(lines) < 5:
        log.info("strip_outside_staff: no confident staff band; skipping")
        return gray

    centers = [(t + b) / 2 for t, b in lines]
    gaps = [centers[i + 1] - centers[i] for i in range(len(centers) - 1)]
    plausible = sorted(g for g in gaps if 3 < g < 60)
    ss = float(plausible[len(plausible) // 2]) if plausible else 10.0

    staff_top, staff_bottom = lines[0][0], lines[-1][1]

    num, labeled, stats, _ = cv2.connectedComponentsWithStats(binary)
    erased = 0
    for lid in range(1, num):
        y_min = stats[lid, cv2.CC_STAT_TOP]
        y_max = y_min + stats[lid, cv2.CC_STAT_HEIGHT] - 1
        above = (
            y_min < staff_top - FAR_ABOVE_SS * ss
            and y_max < staff_top - NEAR_BAND_SS * ss
        )
        below = (
            y_max > staff_bottom + FAR_BELOW_SS * ss
            and y_min > staff_bottom + NEAR_BAND_SS * ss
        )
        if above or below:
            gray[labeled == lid] = 255
            erased += 1

    erased += _erase_above_staff_claps(gray, binary, staff_top, ss)

    if erased:
        log.info(f"strip_outside_staff: erased {erased} out-of-band components")
    return gray
