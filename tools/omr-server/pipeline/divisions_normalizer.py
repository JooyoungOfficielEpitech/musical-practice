"""Collapse a multi-part score to one canonical <divisions> value.

Each per-system homr run emits its own divisions, so concatenating systems
produces a part whose divisions changes mid-stream — and different parts start
at different divisions. That is valid MusicXML (divisions is sticky), but any
consumer that reads divisions once per file mistimes every measure whose
divisions differs from the first one it saw. Rescaling every duration to the
LCM of all divisions makes the whole score share a single divisions, so a
once-per-file reader stays correct and cross-part alignment is preserved.
"""
from __future__ import annotations
import copy
import math
import xml.etree.ElementTree as ET

DEFAULT_DIVISIONS = 2

# Elements whose <duration> child is measured in divisions and must be rescaled.
_TIMED_TAGS = ("note", "backup", "forward")


def _running_divisions(measures: list[ET.Element], default: int) -> list[int]:
    """Divisions in effect for each measure (sticky: inherits the previous one)."""
    current = default
    per_measure = []
    for m in measures:
        d = m.find(".//divisions")
        if d is not None and d.text:
            current = int(d.text)
        per_measure.append(current)
    return per_measure


def _collect_all_divisions(char_measures: dict[str, list[ET.Element]]) -> set[int]:
    found: set[int] = set()
    for measures in char_measures.values():
        for m in measures:
            for d in m.findall(".//divisions"):
                if d.text and int(d.text) > 0:
                    found.add(int(d.text))
    return found


def _scale_measure(measure: ET.Element, factor: int) -> None:
    """Multiply every duration in a (deep-copied) measure by an integer factor."""
    if factor == 1:
        return
    for tag in _TIMED_TAGS:
        for el in measure.findall(tag):
            dur = el.find("duration")
            if dur is not None and dur.text:
                dur.text = str(int(dur.text) * factor)


def _strip_divisions(measure: ET.Element) -> None:
    """Remove any <divisions> elements from a measure's <attributes> blocks."""
    for attrs in measure.findall("attributes"):
        for d in attrs.findall("divisions"):
            attrs.remove(d)
        if len(attrs) == 0:
            measure.remove(attrs)


def _set_divisions(measure: ET.Element, value: int) -> None:
    """Ensure the measure declares divisions=value as the first attributes entry."""
    attrs = measure.find("attributes")
    if attrs is None:
        attrs = ET.Element("attributes")
        measure.insert(0, attrs)
    existing = attrs.find("divisions")
    if existing is None:
        existing = ET.Element("divisions")
        attrs.insert(0, existing)
    existing.text = str(value)


def normalize_divisions(
    char_measures: dict[str, list[ET.Element]],
    target: int | None = None,
) -> dict[str, list[ET.Element]]:
    """Rescale every part to a single canonical divisions.

    Args:
        char_measures: {part_name: [measure elements]}. Not mutated — measures
            are deep-copied before scaling.
        target: Canonical divisions to use. Defaults to the LCM of every
            divisions found across all parts (so all scale factors are integers).

    Returns:
        A new {part_name: [measures]} dict where every part shares one divisions
        value, declared on the first measure only.
    """
    if not char_measures:
        return {}

    if target is None:
        all_divs = _collect_all_divisions(char_measures)
        target = math.lcm(*all_divs) if all_divs else DEFAULT_DIVISIONS

    result: dict[str, list[ET.Element]] = {}
    for name, measures in char_measures.items():
        per_measure_div = _running_divisions(measures, default=target)
        scaled: list[ET.Element] = []
        for idx, measure in enumerate(measures):
            copied = copy.deepcopy(measure)
            source_div = per_measure_div[idx]
            _scale_measure(copied, target // source_div if source_div else 1)
            _strip_divisions(copied)
            scaled.append(copied)
        if scaled:
            _set_divisions(scaled[0], target)
        result[name] = scaled
    return result
