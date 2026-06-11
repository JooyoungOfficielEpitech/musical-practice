"""Classify note components by stem geometry (up vs down vs ambiguous).

A component is a connected ink cluster after staff-line removal: a single
note, a chord on one stem, or a whole beamed group. Classification uses only
stem evidence — never vertical position alone:

- Stem with notehead ink at its bottom (attached left)  → "up" voice.
- Stem with notehead ink at its top (attached right)    → "down" voice.
- No stem, conflicting stems, or chorded heads          → "ambiguous".

Ambiguous components are KEPT IN BOTH voice images downstream — a shared
chord resolves later via chord-splitting, and unison/uncertain content is
musically safer duplicated than deleted.
"""

import logging

import cv2
import numpy as np

log = logging.getLogger("voice_classifier")

# Geometry in staff-space (ss) units
HEAD_REACH_X = 1.6        # how far sideways a head extends from its stem
HEAD_REACH_Y = 1.1        # head height window at the stem end
HEAD_OVERSHOOT = 0.4      # head may extend slightly past the stem tip
HEAD_MIN_INK = 0.22       # × ss² — minimal ink mass to call it a notehead
HEAD_DOMINANCE = 1.3      # winning end needs this × the other end's ink
CHORD_SPAN = 1.8          # × ss — adjacent head ink spanning more ⇒ chord
MIN_STEM_HEIGHT = 1.4     # × ss — minimal vertical run to count as a stem
STEM_STAFF_REACH = 1.0    # × ss — stem must come this close to the staff


def _ink_count(ink: np.ndarray, y1: float, y2: float, x1: float, x2: float) -> float:
    h, w = ink.shape
    y1, y2 = max(0, int(y1)), min(h, int(y2))
    x1, x2 = max(0, int(x1)), min(w, int(x2))
    if y1 >= y2 or x1 >= x2:
        return 0.0
    return float(np.count_nonzero(ink[y1:y2, x1:x2]))


def _stem_runs(comp_stems: np.ndarray, min_height: int) -> list[tuple[int, int, int]]:
    """Return (x_center, y_top, y_bottom) per vertical stem run in a component."""
    num, labels = cv2.connectedComponents(comp_stems.astype(np.uint8))
    runs = []
    for lid in range(1, num):
        ys, xs = np.where(labels == lid)
        if ys.size == 0 or (ys.max() - ys.min() + 1) < min_height:
            continue
        runs.append((int(round(float(xs.mean()))), int(ys.min()), int(ys.max())))
    return runs


def _adjacent_head_rows(ink: np.ndarray, x: int, top: int, bot: int, ss: float) -> float:
    """Count rows along the stem with significant head ink next to it."""
    h, w = ink.shape
    y1 = max(0, int(top - HEAD_OVERSHOOT * ss))
    y2 = min(h, int(bot + HEAD_OVERSHOOT * ss))
    x1 = max(0, int(x - HEAD_REACH_X * ss))
    x2 = min(w, int(x + HEAD_REACH_X * ss))
    if y1 >= y2 or x1 >= x2:
        return 0.0
    band = ink[y1:y2, x1:x2]
    row_ink = np.count_nonzero(band, axis=1)
    return float(np.sum(row_ink >= max(2, int(0.3 * ss))))


def _vote_stem(
    ink: np.ndarray,
    x: int,
    top: int,
    bot: int,
    ss: float,
    staff_band: tuple[float, float],
) -> str:
    """Vote one stem: 'up', 'down', 'chord', or 'none'."""
    staff_top, staff_bot = staff_band

    # Barlines span the whole staff edge-to-edge — never a note stem.
    if top <= staff_top + 0.3 * ss and bot >= staff_bot - 0.3 * ss:
        return "none"

    if _adjacent_head_rows(ink, x, top, bot, ss) > CHORD_SPAN * ss:
        return "chord"

    reach_x, reach_y, over = HEAD_REACH_X * ss, HEAD_REACH_Y * ss, HEAD_OVERSHOOT * ss
    bottom_ink = (
        _ink_count(ink, bot - reach_y, bot + over, x - reach_x, x - 1)
        + _ink_count(ink, bot - reach_y, bot + over, x + 2, x + reach_x)
    )
    top_ink = (
        _ink_count(ink, top - over, top + reach_y, x - reach_x, x - 1)
        + _ink_count(ink, top - over, top + reach_y, x + 2, x + reach_x)
    )

    # The notehead must sit in this staff's pitch range — content bleeding in
    # from a neighbouring staff must not vote here.
    margin = 2.5 * ss
    head_y_bottom = bot - 0.5 * reach_y   # head centre for an up-stem
    head_y_top = top + 0.5 * reach_y      # head centre for a down-stem
    bottom_in_band = staff_top - margin <= head_y_bottom <= staff_bot + margin
    top_in_band = staff_top - margin <= head_y_top <= staff_bot + margin

    min_head = HEAD_MIN_INK * ss * ss
    if bottom_in_band and bottom_ink >= min_head and bottom_ink > HEAD_DOMINANCE * top_ink:
        return "up"
    if top_in_band and top_ink >= min_head and top_ink > HEAD_DOMINANCE * bottom_ink:
        return "down"
    return "none"


def classify_component(
    info: dict,
    stems: np.ndarray,
    note_ink: np.ndarray,
    staff_spacing: float,
    staff_band: tuple[float, float],
) -> tuple[str, int]:
    """Classify one component as ('up'|'down'|'ambiguous', n_stem_votes).

    The vote count weights beamed groups correctly: a 4-note beamed run is one
    component but four stems' worth of evidence.

    Args:
        info: Component dict with mask/bbox fields (see voice_separator).
        stems: Binary stem image (detected on the ORIGINAL binary, so stems
            are continuous through staff lines).
        note_ink: Binary ink with staff lines, stems and beams removed —
            what remains is notehead-ish material used for stem votes.
        staff_spacing: Vertical distance between staff lines.
        staff_band: (y of first staff line, y of last staff line) — the raw
            staff extent. Margins are applied here: anything fully outside
            ±2.5 staff spaces (lyrics, dynamics) is ambiguous.
    """
    staff_top, staff_bot = staff_band
    margin = 2.5 * staff_spacing
    if info["y_max"] < staff_top - margin or info["y_min"] > staff_bot + margin:
        return "ambiguous", 0

    comp_stems = np.logical_and(stems > 0, info["mask"])
    min_h = max(3, int(MIN_STEM_HEIGHT * staff_spacing))
    runs = _stem_runs(comp_stems, min_h)

    # A real note stem reaches the staff vicinity; lyric strokes do not.
    reach = STEM_STAFF_REACH * staff_spacing
    runs = [
        (x, t, b) for x, t, b in runs
        if b >= staff_top - reach and t <= staff_bot + reach
    ]
    if not runs:
        return "ambiguous", 0

    up_votes = down_votes = 0
    for x, top, bot in runs:
        vote = _vote_stem(note_ink, x, top, bot, staff_spacing, staff_band)
        if vote == "chord":
            return "ambiguous", 0
        if vote == "up":
            up_votes += 1
        elif vote == "down":
            down_votes += 1

    if up_votes and down_votes:
        return "ambiguous", 0
    if up_votes:
        return "up", up_votes
    if down_votes:
        return "down", down_votes
    return "ambiguous", 0


def _is_notehead_like(info: dict, ss: float, staff_band: tuple[float, float]) -> bool:
    margin = 2.5 * ss
    if info["y_max"] < staff_band[0] - margin or info["y_min"] > staff_band[1] + margin:
        return False
    return 0.5 * ss <= info["h"] <= 1.7 * ss and 0.7 * ss <= info["w"] <= 2.4 * ss


def _x_overlap_ratio(a: dict, b: dict) -> float:
    overlap = min(a["x_max"], b["x_max"]) - max(a["x_min"], b["x_min"]) + 1
    if overlap <= 0:
        return 0.0
    return overlap / max(1, min(a["w"], b["w"]))


def pair_stemless(
    components: list[dict],
    classifications: list[str],
    staff_spacing: float,
    staff_band: tuple[float, float],
) -> list[str]:
    """Assign stemless notehead pairs that share an x-position (whole notes).

    Only when EXACTLY two notehead-like ambiguous components overlap in x and
    are vertically separated does the upper become 'up' and the lower 'down'.
    Everything else stays ambiguous (kept in both voice images).
    """
    result = list(classifications)
    cands = [
        i for i, c in enumerate(classifications)
        if c == "ambiguous" and _is_notehead_like(components[i], staff_spacing, staff_band)
    ]
    used: set[int] = set()
    for i in cands:
        if i in used:
            continue
        partners = [
            j for j in cands
            if j != i and j not in used
            and _x_overlap_ratio(components[i], components[j]) > 0.5
        ]
        if len(partners) != 1:
            continue
        j = partners[0]
        hi, lo = (i, j) if components[i]["cy"] < components[j]["cy"] else (j, i)
        if components[lo]["cy"] - components[hi]["cy"] > 0.8 * staff_spacing:
            result[hi], result[lo] = "up", "down"
            used.update((i, j))
    return result
