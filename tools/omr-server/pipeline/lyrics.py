"""Lyric extraction: OCR tokens → per-measure syllables → <lyric> injection.

Flow (page level, after the ensemble pass):
1. Vision OCR gives per-syllable tokens with page-pixel boxes (vision_ocr).
2. Each vocal staff owns a "lyric band": the horizontal strip between its
   bottom staff line and the next staff (geometry from staff_cropper).
3. Barlines are detected inside the staff's y-band; lyrics are only attached
   when the detected measure count matches the OMR measure count — never a
   guessed alignment.
4. Tokens in the band are sorted by x, hyphen runs are merged into syllable
   chains (Chuck - a → Chuck[begin] a[end]), bucketed per measure, and
   attached to that measure's singable notes in order.

Strictly additive: any failure leaves the measures untouched.
"""
from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from dataclasses import dataclass

import numpy as np

from pipeline.vision_ocr import OcrToken

log = logging.getLogger("omr.lyrics")

# Tokens that appear under staves but are never lyrics.
_NON_LYRIC = {
    "mf", "mp", "f", "ff", "fff", "p", "pp", "ppp", "sfz", "fp",
    "cresc.", "dim.", "rit.", "accel.", "sim.", "solo", "tutti", "unis.",
}
# Chord symbols (Bb7, Dbmaj7, F#m…) sit above a lead-sheet staff but can fall
# inside the vocal staff's lyric band right above it.
import re as _re
_CHORD_RE = _re.compile(r"^[A-G][b#]?(maj|min|dim|aug|sus|add|m)?\d*(/[A-G][b#]?)?$")
_BAND_MARGIN_PX = 3
_BARLINE_COVERAGE = 0.95
_MEASURE_EDGE_TOLERANCE_PX = 4
# Repeat/double barlines are a thick+thin pair a few px apart — one boundary.
_MERGE_RADIUS_PX = 14


@dataclass(frozen=True)
class StaffBand:
    """Page-space geometry for one vocal staff and its lyric strip."""

    char: str
    top: float
    bottom: float
    band_bottom: float


@dataclass
class Syllable:
    text: str
    cx: float
    syllabic: str  # single | begin | middle | end


def is_lyric_token(text: str) -> bool:
    t = text.strip()
    if not t or t == "-":
        return False
    if t.lower() in _NON_LYRIC:
        return False
    # Bare numbers under a staff are measure numbers / tempo digits.
    if all(c.isdigit() or c in ".,()" for c in t):
        return False
    # Single letters stay ("A-le-lu…"); real chord leaks carry accidentals
    # or qualities (Db, Bb7, F#m) and are ≥2 chars.
    if len(t) >= 2 and _CHORD_RE.match(t):
        return False
    return any(c.isalnum() for c in t)


def band_tokens(tokens: list[OcrToken], band: StaffBand) -> list[OcrToken]:
    """Tokens whose vertical center sits in the staff's lyric strip."""
    y0 = band.bottom + _BAND_MARGIN_PX
    y1 = band.band_bottom - _BAND_MARGIN_PX
    picked = [t for t in tokens if y0 <= t.cy <= y1 and (is_lyric_token(t.text) or t.text == "-")]
    return sorted(picked, key=lambda t: t.cx)


def split_rows(tokens: list[OcrToken]) -> list[list[OcrToken]]:
    """Cluster band tokens into horizontal text rows (top to bottom).

    Bilingual scores print two stacked lyric lines (English above, Korean
    below); mixing them by x interleaves the languages into garbage.
    """
    if not tokens:
        return []
    heights = sorted(t.y1 - t.y0 for t in tokens)
    row_gap = max(6.0, heights[len(heights) // 2] * 0.8)
    rows: list[list[OcrToken]] = []
    for t in sorted(tokens, key=lambda t: t.cy):
        if rows and abs(t.cy - sum(x.cy for x in rows[-1]) / len(rows[-1])) <= row_gap:
            rows[-1].append(t)
        else:
            rows.append([t])
    return [sorted(r, key=lambda t: t.cx) for r in rows]


def _hangul_count(row: list[OcrToken]) -> int:
    return sum(
        1 for t in row for c in t.text if 0xAC00 <= ord(c) <= 0xD7A3
    )


def select_lyric_row(rows: list[list[OcrToken]]) -> list[OcrToken]:
    """Pick ONE lyric line: the row with the most hangul (the singer's
    language in this repertoire), else the row nearest the staff."""
    if not rows:
        return []
    best = max(rows, key=_hangul_count)
    if _hangul_count(best) > 0:
        return best
    return rows[0]


def merge_hyphens(tokens: list[OcrToken]) -> list[Syllable]:
    """Turn an x-sorted token stream into syllables with syllabic markers.

    A standalone "-" joins its neighbours into one word: the token before it
    becomes begin/middle, the token after it becomes middle/end. Hangul
    syllables and unhyphenated words stay "single".
    """
    syllables: list[Syllable] = []
    open_word = False  # previous syllable expects a continuation
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        if tok.text == "-":
            if syllables and not open_word:
                prev = syllables[-1]
                prev.syllabic = "middle" if prev.syllabic in ("middle", "end") else "begin"
                open_word = True
            i += 1
            continue
        if not is_lyric_token(tok.text):
            i += 1
            continue
        text = tok.text
        # Trailing hyphen glued onto the token ("Chuck-") opens a word too.
        glued_open = text.endswith("-") and len(text) > 1
        text = text.rstrip("-") if glued_open else text
        if open_word:
            syllables.append(Syllable(text, tok.cx, "end"))
            open_word = False
        else:
            syllables.append(Syllable(text, tok.cx, "single"))
        if glued_open:
            prev = syllables[-1]
            prev.syllabic = "middle" if prev.syllabic == "end" else "begin"
            open_word = True
        i += 1
    return syllables


def detect_barlines(bw: np.ndarray, top: int, bottom: int) -> list[int]:
    """Column x-positions of barlines crossing the [top, bottom] staff band.

    bw: binarized page (nonzero = ink). A barline column covers (almost) the
    whole staff height; note stems don't. Adjacent columns are grouped.
    """
    if bottom <= top:
        return []
    band = bw[top:bottom, :]
    coverage = (band > 0).mean(axis=0)
    hits = np.where(coverage >= _BARLINE_COVERAGE)[0]
    if hits.size == 0:
        return []
    groups: list[int] = []
    start = prev = int(hits[0])
    for x in hits[1:]:
        x = int(x)
        if x - prev > 2:
            groups.append((start + prev) // 2)
            start = x
        prev = x
    groups.append((start + prev) // 2)
    return groups


_NEIGHBOR_WINDOW_PX = (4, 16)
_NEIGHBOR_MAX_COVERAGE = 0.35


def _is_isolated_vertical(
    bw: np.ndarray, top: int, bottom: int, x: int, hit_columns: set[int]
) -> bool:
    """True when the column stands alone like a barline.

    A stem carries notehead/beam ink in its immediate neighborhood; a barline's
    neighbours contain only the five staff lines. Columns that are themselves
    barline candidates (double bars, repeat partners) are excluded.
    """
    lo, hi = _NEIGHBOR_WINDOW_PX
    for side in (range(x - hi, x - lo + 1), range(x + lo, x + hi + 1)):
        cols = [
            c for c in side
            if 0 <= c < bw.shape[1] and all(abs(c - h) > 3 for h in hit_columns)
        ]
        if not cols:
            continue
        # A stem has notehead/beam ink on at least ONE side — check each side.
        if (bw[top:bottom, cols] > 0).mean() > _NEIGHBOR_MAX_COVERAGE:
            return False
    return True


def merge_close_boundaries(xs: list[int], radius: int = _MERGE_RADIUS_PX) -> list[int]:
    """Fold barline groups closer than radius (double bars, repeats) into one."""
    if not xs:
        return []
    merged: list[list[int]] = [[xs[0]]]
    for x in xs[1:]:
        if x - merged[-1][-1] <= radius:
            merged[-1].append(x)
        else:
            merged.append([x])
    return [sum(g) // len(g) for g in merged]


def _match_count(xs: list[int], n_measures: int) -> list[int] | None:
    """Boundaries that fit the OMR measure count, or None.

    A system whose first measure is preceded by a clef/key/time header plus a
    start barline yields exactly one extra leading segment — drop it.
    Anything else that still mismatches → None (no guess)."""
    if len(xs) - 1 == n_measures:
        return xs
    if len(xs) - 2 == n_measures:
        return xs[1:]
    return None


def system_boundaries(
    bw: np.ndarray, staff_bands: list["StaffBand"]
) -> list[int]:
    """Consensus barline x-positions across all staves of one system.

    Barlines are vertically aligned across the system's staves; note stems are
    not. A candidate column counts when it appears (within a small radius) in
    the majority of staves. Single-staff systems fall back to the isolation
    heuristic.
    """
    per_staff = [
        detect_barlines(bw, int(b.top), int(b.bottom)) for b in staff_bands
    ]
    if len(per_staff) == 1:
        raw = per_staff[0]
        hit_columns = set(raw)
        b = staff_bands[0]
        return [
            x for x in raw
            if _is_isolated_vertical(bw, int(b.top), int(b.bottom), x, hit_columns)
        ]
    all_xs = sorted(x for xs in per_staff for x in xs)
    if not all_xs:
        return []
    # Cluster all candidates, then keep clusters seen in most staves.
    clusters: list[list[int]] = [[all_xs[0]]]
    for x in all_xs[1:]:
        if x - clusters[-1][-1] <= 6:
            clusters[-1].append(x)
        else:
            clusters.append([x])
    quorum = max(2, (len(per_staff) + 1) // 2)
    out = []
    for cluster in clusters:
        center = sum(cluster) // len(cluster)
        votes = sum(
            1 for xs in per_staff if any(abs(x - center) <= 6 for x in xs)
        )
        if votes >= quorum:
            out.append(center)
    return out


def measure_boundaries(
    bw: np.ndarray, top: int, bottom: int, n_measures: int
) -> list[int] | None:
    """Single-staff boundary detection (kept for tests / lead-sheet mode)."""
    raw = detect_barlines(bw, top, bottom)
    hit_columns = set(raw)
    isolated = [x for x in raw if _is_isolated_vertical(bw, top, bottom, x, hit_columns)]
    return _match_count(merge_close_boundaries(isolated), n_measures)


def bucket_by_measure(syllables: list[Syllable], boundaries: list[int]) -> list[list[Syllable]]:
    """Assign syllables to measures via barline x-boundaries."""
    n_measures = len(boundaries) - 1
    buckets: list[list[Syllable]] = [[] for _ in range(n_measures)]
    for syl in syllables:
        for m in range(n_measures):
            lo = boundaries[m] - (_MEASURE_EDGE_TOLERANCE_PX if m == 0 else 0)
            hi = boundaries[m + 1] + (_MEASURE_EDGE_TOLERANCE_PX if m == n_measures - 1 else 0)
            if lo <= syl.cx < hi:
                buckets[m].append(syl)
                break
    return buckets


def _singable_notes(measure: ET.Element) -> list[ET.Element]:
    """Notes that can carry a syllable: pitched/unpitched, not rests, not
    chord upper voices, not tie continuations."""
    out = []
    for note in measure.findall("note"):
        if note.find("rest") is not None:
            continue
        if note.find("chord") is not None:
            continue
        ties = [t.get("type") for t in note.findall("tie")]
        if "stop" in ties:
            continue
        out.append(note)
    return out


def attach_syllables_to_measure(measure: ET.Element, syllables: list[Syllable]) -> int:
    """Attach syllables (already x-sorted) to the measure's singable notes.

    1:1 in order; extra notes are a melisma (fine), extra syllables are
    dropped with a log. Returns how many lyrics were attached.
    """
    notes = _singable_notes(measure)
    count = min(len(notes), len(syllables))
    for note, syl in zip(notes[:count], syllables[:count]):
        lyric = ET.SubElement(note, "lyric")
        ET.SubElement(lyric, "syllabic").text = syl.syllabic
        ET.SubElement(lyric, "text").text = syl.text
    if len(syllables) > len(notes):
        log.info(
            "lyrics: %d syllables for %d singable notes — dropped %d",
            len(syllables), len(notes), len(syllables) - len(notes),
        )
    return count


# Compound staves carry one shared lyric line — attach it to the top voice.
_COMPOUND_TARGET = {"Co.SA": "Soprano", "Co.TB": "Tenor"}


def attach_lyrics_for_page(
    tokens: list[OcrToken],
    bw_page: np.ndarray,
    bands: list[tuple[StaffBand, int]],
    char_sys: dict[str, dict[int, list[ET.Element]]],
) -> int:
    """Attach lyrics for one page. Returns total lyrics attached.

    bands: [(StaffBand, global_sys_idx)] in page order.
    char_sys: {char: {global_sys_idx: [measure Elements]}} (post-ensemble).
    """
    total = 0
    by_system: dict[int, list[StaffBand]] = {}
    for band, g_idx in bands:
        by_system.setdefault(g_idx, []).append(band)
    consensus = {
        g_idx: merge_close_boundaries(system_boundaries(bw_page, sys_bands))
        for g_idx, sys_bands in by_system.items()
    }

    for band, g_idx in bands:
        target_char = _COMPOUND_TARGET.get(band.char, band.char)
        sys_measures = char_sys.get(target_char, {}).get(g_idx)
        if not sys_measures:
            continue

        boundaries = _match_count(consensus.get(g_idx, []), len(sys_measures))
        if boundaries is None:
            log.info(
                "lyrics: barline/measure mismatch for %s sys%d (%d measures, %d boundaries) — skipping",
                band.char, g_idx, len(sys_measures), len(consensus.get(g_idx, [])),
            )
            continue

        rows = split_rows(band_tokens(tokens, band))
        syllables = merge_hyphens(select_lyric_row(rows))
        if not syllables:
            continue
        for m_idx, bucket in enumerate(bucket_by_measure(syllables, boundaries)):
            if bucket:
                total += attach_syllables_to_measure(sys_measures[m_idx], bucket)
    return total
