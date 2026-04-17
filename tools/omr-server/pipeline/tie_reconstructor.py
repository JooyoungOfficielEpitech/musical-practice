"""Tie reconstruction post-processing step using music21.

Adds tie markings between consecutive same-pitch notes that cross barlines
when homr drops them during OMR recognition.
"""

import logging
import xml.etree.ElementTree as ET

log = logging.getLogger("omr.tie_reconstructor")

try:
    import music21  # noqa: F401
    _MUSIC21_AVAILABLE = True
except ImportError:
    _MUSIC21_AVAILABLE = False
    log.warning("music21 not available — tie reconstruction disabled")


def _pitch_key(note_el: ET.Element) -> tuple | None:
    """Return (step, octave, alter) tuple for a pitched note, or None for rests."""
    p = note_el.find("pitch")
    if p is None:
        return None
    step = p.findtext("step", "")
    octave = p.findtext("octave", "")
    alter = p.findtext("alter", "0")
    return (step, octave, alter)


def _is_already_tied_start(note_el: ET.Element) -> bool:
    return any(t.get("type") == "start" for t in note_el.findall("tie"))


def _is_already_tied_stop(note_el: ET.Element) -> bool:
    return any(t.get("type") == "stop" for t in note_el.findall("tie"))


def _last_pitched_note(measure: ET.Element) -> ET.Element | None:
    """Return the last non-rest, non-chord note in a measure."""
    notes = [
        n for n in measure.findall("note")
        if n.find("pitch") is not None and n.find("chord") is None
    ]
    return notes[-1] if notes else None


def _first_pitched_note(measure: ET.Element) -> ET.Element | None:
    """Return the first non-rest, non-chord note in a measure."""
    for n in measure.findall("note"):
        if n.find("pitch") is not None and n.find("chord") is None:
            return n
    return None


def _add_tie_start(note_el: ET.Element) -> None:
    """Add <tie type="start"/> and <notations><tied type="start"/></notations>."""
    tie = ET.SubElement(note_el, "tie")
    tie.set("type", "start")
    notations = note_el.find("notations")
    if notations is None:
        notations = ET.SubElement(note_el, "notations")
    tied = ET.SubElement(notations, "tied")
    tied.set("type", "start")


def _add_tie_stop(note_el: ET.Element) -> None:
    """Add <tie type="stop"/> and <notations><tied type="stop"/></notations>."""
    tie = ET.SubElement(note_el, "tie")
    tie.set("type", "stop")
    notations = note_el.find("notations")
    if notations is None:
        notations = ET.SubElement(note_el, "notations")
    tied = ET.SubElement(notations, "tied")
    tied.set("type", "stop")


def _reconstruct_ties_in_part(part: ET.Element) -> None:
    """Mutate part in-place: add tie markings across barlines for same-pitch pairs."""
    measures = part.findall("measure")
    for i in range(len(measures) - 1):
        end_note = _last_pitched_note(measures[i])
        start_note = _first_pitched_note(measures[i + 1])
        if end_note is None or start_note is None:
            continue
        if _pitch_key(end_note) != _pitch_key(start_note):
            continue
        if _is_already_tied_start(end_note) or _is_already_tied_stop(start_note):
            continue
        _add_tie_start(end_note)
        _add_tie_stop(start_note)


def reconstruct_ties(xml_string: str) -> str:
    """Add tie markings for consecutive same-pitch notes crossing barlines.

    Uses music21 availability as a guard (graceful fallback if not installed).
    The actual reconstruction is done with ElementTree for speed and reliability.

    Args:
        xml_string: Raw MusicXML string (may or may not have ties).

    Returns:
        MusicXML string with tie markings added where appropriate.
    """
    if not _MUSIC21_AVAILABLE:
        log.warning("music21 not installed — skipping tie reconstruction")
        return xml_string

    try:
        root = ET.fromstring(xml_string)
    except ET.ParseError as exc:
        log.warning("reconstruct_ties: invalid XML (%s) — returning unchanged", exc)
        return xml_string

    for part in root.findall(".//part"):
        _reconstruct_ties_in_part(part)

    return ET.tostring(root, encoding="unicode", xml_declaration=True)
