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
LEDGER_MIN_RUN_SS = 0.8   # a ledger is a short horizontal ink run near the note
LEDGER_MAX_RUN_SS = 3.5   # longer runs are beams (clap lanes), not ledgers


def _has_ledger_near(
    binary: np.ndarray, cx: float, cy: float, staff_top: int, staff_bottom: int, ss: float
) -> bool:
    """True when a ledger-line-like run sits at a ledger position near (cx, cy).

    Legitimate above/below-staff notes (e.g. the tenor line riding above a T/B
    bass staff) sit on short ledger lines at whole-space multiples from the
    staff; clap-lane x-heads and neighbour bleed have none. Beam segments are
    excluded by capping the run length.
    """
    h, w = binary.shape
    for k in range(1, 5):
        for ly in (staff_top - k * ss, staff_bottom + k * ss):
            ly = int(round(ly))
            if ly < 0 or ly >= h or abs(cy - ly) > 1.2 * ss:
                continue
            x0, x1 = max(0, int(cx - 1.5 * ss)), min(w, int(cx + 1.5 * ss))
            by0 = max(0, ly - 2)
            band = binary[by0:ly + 3, x0:x1]
            if band.size == 0:
                continue
            # A ledger is FLAT and THIN: ink confined to <=3 rows per column at
            # a near-constant row. The head interrupts it, so collect flat thin
            # SEGMENTS (stubs left/right of the head) and group by row; beams
            # are thicker than 3px per column and x-strokes drift diagonally,
            # so both fail these checks.
            col_ink = np.count_nonzero(band, axis=0)
            rows_idx = np.arange(band.shape[0])
            segments: list[tuple[list[int], list[float]]] = []
            cur_cols: list[int] = []
            cur_cent: list[float] = []
            for ci in range(band.shape[1] + 1):
                thin = ci < band.shape[1] and 0 < col_ink[ci] <= 3
                if thin:
                    cur_cols.append(ci)
                    cur_cent.append(float(np.dot(rows_idx, band[:, ci] > 0) / col_ink[ci]))
                elif cur_cols:
                    if len(cur_cols) >= 3 and max(cur_cent) - min(cur_cent) <= 1.5:
                        segments.append((cur_cols, cur_cent))
                    cur_cols, cur_cent = [], []
            for base_cols, base_cent in segments:
                level = float(np.mean(base_cent))
                group_cols: list[int] = []
                for cols, cent in segments:
                    if abs(float(np.mean(cent)) - level) <= 1.5:
                        group_cols.extend(cols)
                if not (0.6 * ss <= len(group_cols) <= LEDGER_MAX_RUN_SS * ss):
                    continue
                # A ledger is vertically ISOLATED: white above and below the
                # line. Test only stub columns away from the head (the head's
                # ring puts ink above/below near its own center). Lyric text
                # and beam clusters have strokes in these rows and fail.
                abs_cols = np.array(
                    [c + x0 for c in group_cols if abs(c + x0 - cx) > 0.5 * ss]
                )
                if len(abs_cols) < 3:
                    continue
                iso_ink = 0
                iso_cells = 0
                for dy in (-6, -5, -4, 4, 5, 6):
                    ry = ly + dy
                    if 0 <= ry < h:
                        iso_ink += int(np.count_nonzero(binary[ry, abs_cols]))
                        iso_cells += len(abs_cols)
                if iso_cells and iso_ink <= 0.15 * iso_cells:
                    return True
    return False


def _erase_above_staff_claps(
    gray: np.ndarray, binary: np.ndarray, staff_top: int, staff_bottom: int, ss: float
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
            # Ledger-line notes above the staff (tenor line on a T/B staff)
            # can score against the x template — never column-wipe them.
            if _has_ledger_near(binary, cx, cy, staff_top, staff_bottom, ss):
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
            cx = stats[lid, cv2.CC_STAT_LEFT] + stats[lid, cv2.CC_STAT_WIDTH] / 2
            cy = (y_min + y_max) / 2
            # Notes on ledger lines (tenor above a T/B staff) are content of
            # this staff even when fully outside the band — keep them.
            if _has_ledger_near(binary, cx, cy, staff_top, staff_bottom, ss):
                continue
            gray[labeled == lid] = 255
            erased += 1

    erased += _erase_above_staff_claps(gray, binary, staff_top, staff_bottom, ss)

    if erased:
        log.info(f"strip_outside_staff: erased {erased} out-of-band components")
    return gray
