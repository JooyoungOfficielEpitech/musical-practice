"""Force every measure of every part onto a shared bar grid.

The mobile-app MusicXML parser (client/lib/audio/musicXmlParser.ts) schedules each
<part> independently, accumulating note durations from t=0, and never re-synchronises
parts at barlines. So if any measure of one part sums to a different number of beats
than the same measure in another part, those parts drift apart for the rest of the
piece — this is the "Hermes 음이랑 앙상블 음이 어긋난다" bug.

align_and_flatten already equalises measure COUNT across parts per system. This module
adds the missing guarantee: every measure sums to EXACTLY bar_beats. Once that holds,
every part has the same cumulative beats at every barline, so cross-part drift is
mathematically impossible regardless of any per-part OMR rhythm error.

Runs AFTER normalize_divisions. It works per part on that part's own running divisions,
so it equalises BEATS (duration / divisions), not raw duration units. Overflowing
measures (missed barline, doubled note values, long narration) are scale-compressed to
the bar — preserving every note and the measure count — and short measures are padded
with a trailing rest. Splitting is deliberately avoided: it would change the measure
count and re-break cross-part alignment.
"""
import copy
import logging
import math
import xml.etree.ElementTree as ET
from fractions import Fraction

log = logging.getLogger("omr.measure_grid")

DEFAULT_DIVISIONS = 2
DEFAULT_BAR_BEATS = 4.0  # 4/4
# Work on a fine grid so scale-compression keeps clean, non-degenerate note values.
MIN_WORK_DIVISIONS = 24

_TIMED_TAGS = ("note", "backup", "forward")


def _part_divisions(measures: list[ET.Element]) -> int:
    """First <divisions> declared anywhere in the part (sticky), or the default."""
    for m in measures:
        d = m.find(".//divisions")
        if d is not None and d.text:
            return int(d.text)
    return DEFAULT_DIVISIONS


def _running_bar_beats(measures: list[ET.Element], override: float | None) -> list[float]:
    """Quarter-note beats per bar for each measure (sticky from <time>, or override)."""
    if override is not None:
        return [override] * len(measures)
    current = DEFAULT_BAR_BEATS
    out: list[float] = []
    for m in measures:
        t = m.find(".//time")
        if t is not None:
            beats = t.findtext("beats")
            beat_type = t.findtext("beat-type")
            if beats and beat_type and int(beat_type) > 0:
                current = int(beats) * 4 / int(beat_type)
        out.append(current)
    return out


def _span(measure: ET.Element) -> int:
    """Total occupied duration of a measure's main voice (chord notes share a slot)."""
    total = 0
    for note in measure.findall("note"):
        if note.find("chord") is not None:
            continue
        d = note.find("duration")
        if d is not None and d.text:
            total += int(d.text)
    for tag in ("backup", "forward"):
        for el in measure.findall(tag):
            d = el.find("duration")
            if d is not None and d.text:
                total += int(d.text)
    return total


def _scale_all_durations(measure: ET.Element, factor: int) -> None:
    """Multiply every timed <duration> by an integer factor (exact; type stays valid)."""
    if factor == 1:
        return
    for tag in _TIMED_TAGS:
        for el in measure.findall(tag):
            d = el.find("duration")
            if d is not None and d.text:
                d.text = str(int(d.text) * factor)


def _append_rest(measure: ET.Element, duration: int) -> None:
    """Append a single trailing rest of the given duration (no <type>: it may be irregular)."""
    note = ET.SubElement(measure, "note")
    ET.SubElement(note, "rest")
    ET.SubElement(note, "duration").text = str(duration)


def _compress_to(measure: ET.Element, span: int, target: int) -> None:
    """Scale every duration so the main voice sums to exactly `target`.

    Floors each scaled duration (clamped to >= 1) then absorbs the rounding
    remainder into the last main note, guaranteeing an exact total.
    """
    factor = Fraction(target, span)
    total = 0
    last_main: ET.Element | None = None
    for note in measure.findall("note"):
        d = note.find("duration")
        if d is None or not d.text:
            continue
        d.text = str(max(1, int(int(d.text) * factor)))
        if note.find("chord") is None:
            total += int(d.text)
            last_main = note
    for tag in ("backup", "forward"):
        for el in measure.findall(tag):
            d = el.find("duration")
            if d is None or not d.text:
                continue
            d.text = str(max(1, int(int(d.text) * factor)))
            total += int(d.text)

    remainder = target - total
    if remainder != 0 and last_main is not None:
        d = last_main.find("duration")
        d.text = str(max(1, int(d.text) + remainder))


def _strip_divisions(measure: ET.Element) -> None:
    for attrs in measure.findall("attributes"):
        for d in attrs.findall("divisions"):
            attrs.remove(d)
        if len(attrs) == 0:
            measure.remove(attrs)


def _set_divisions(measure: ET.Element, value: int) -> None:
    """Declare <divisions>=value as the first entry of the measure's <attributes>."""
    attrs = measure.find("attributes")
    if attrs is None:
        attrs = ET.Element("attributes")
        measure.insert(0, attrs)
    existing = attrs.find("divisions")
    if existing is None:
        existing = ET.Element("divisions")
        attrs.insert(0, existing)
    existing.text = str(value)


def enforce_bar_grid(
    char_measures: dict[str, list[ET.Element]],
    bar_beats: float | None = None,
) -> dict[str, list[ET.Element]]:
    """Force every measure of every part to sum to exactly one bar.

    Args:
        char_measures: {part_name: [measure elements]}. Not mutated — measures are
            deep-copied before modification.
        bar_beats: Quarter-note beats per bar. Defaults to reading each measure's
            <time> signature (sticky), falling back to 4.0 (4/4).

    Returns:
        A new {part_name: [measures]} dict where every measure sums to exactly the
        bar length, every part keeps its measure count, and each part declares a
        single fine-grained <divisions> on its first measure.
    """
    result: dict[str, list[ET.Element]] = {}

    for name, measures in char_measures.items():
        if not measures:
            result[name] = []
            continue

        src_div = _part_divisions(measures)
        work_div = math.lcm(src_div, MIN_WORK_DIVISIONS)
        scale_up = work_div // src_div
        beats_per_measure = _running_bar_beats(measures, bar_beats)

        out_measures: list[ET.Element] = []
        adjusted = 0
        for idx, measure in enumerate(measures):
            new_m = copy.deepcopy(measure)
            _scale_all_durations(new_m, scale_up)

            target = round(beats_per_measure[idx] * work_div)
            span = _span(new_m)

            if span == target:
                pass
            elif span == 0:
                _append_rest(new_m, target)
                adjusted += 1
            elif span < target:
                _append_rest(new_m, target - span)
                adjusted += 1
            else:  # span > target
                _compress_to(new_m, span, target)
                adjusted += 1

            out_measures.append(new_m)

        # Single canonical divisions for the whole part, declared once.
        for m in out_measures:
            _strip_divisions(m)
        _set_divisions(out_measures[0], work_div)

        if adjusted:
            log.info("enforce_bar_grid[%s]: regridded %d/%d measures (divisions=%d)",
                     name, adjusted, len(out_measures), work_div)
        result[name] = out_measures

    return result
