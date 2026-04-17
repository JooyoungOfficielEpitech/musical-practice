"""Align TB measure rhythm to SA reference.

homr misreads note values in bass clef staves (e.g. dotted quarter → dotted eighth).
Since SA and TB are from the same system, they share the same time structure.
This module copies SA's rhythmic structure onto TB notes, keeping TB's pitches.
"""
import copy
import logging
import xml.etree.ElementTree as ET

log = logging.getLogger("omr.duration_aligner")

_TYPE_TO_QUARTERS: dict[str, float] = {
    "whole": 4.0, "half": 2.0, "quarter": 1.0,
    "eighth": 0.5, "16th": 0.25, "32nd": 0.125, "64th": 0.0625,
}


def _get_divisions(measures: list[ET.Element]) -> int:
    for m in measures:
        div = m.find(".//divisions")
        if div is not None and div.text:
            return int(div.text)
    return 2


def _main_notes(measure: ET.Element) -> list[ET.Element]:
    """Return non-chord notes (each represents one rhythmic position)."""
    return [n for n in measure.findall("note") if n.find("chord") is None]


def _chord_notes_after(measure: ET.Element, main_note: ET.Element) -> list[ET.Element]:
    """Return all <chord> notes immediately following main_note."""
    all_notes = measure.findall("note")
    try:
        idx = list(all_notes).index(main_note)
    except ValueError:
        return []
    result = []
    for n in all_notes[idx + 1:]:
        if n.find("chord") is None:
            break
        result.append(n)
    return result


def _apply_rhythm(note: ET.Element, note_type: str, has_dot: bool, divisions: int) -> None:
    """Update duration, type, and dot of a note in-place."""
    beats = _TYPE_TO_QUARTERS.get(note_type, 1.0) * (1.5 if has_dot else 1.0)
    new_dur = round(divisions * beats)

    dur_el = note.find("duration")
    if dur_el is not None:
        dur_el.text = str(new_dur)

    type_el = note.find("type")
    if type_el is not None:
        type_el.text = note_type

    existing_dot = note.find("dot")
    if has_dot and existing_dot is None:
        note.append(ET.Element("dot"))
    elif not has_dot and existing_dot is not None:
        note.remove(existing_dot)


def align_rhythm_to_reference(
    ref_measures: list[ET.Element],
    target_measures: list[ET.Element],
) -> list[ET.Element]:
    """Copy rhythmic structure from ref_measures onto target_measures.

    Pitches in target are preserved. Only duration, type, and dot are updated.
    If a measure has a different note count from reference, it is left unchanged.

    Args:
        ref_measures:    Soprano measure elements (reliable treble clef recognition).
        target_measures: Tenor or Bass measure elements (bass clef, may have wrong rhythm).

    Returns:
        New list of corrected target measure elements.
    """
    tgt_div = _get_divisions(target_measures)
    result: list[ET.Element] = []

    for ref_m, tgt_m in zip(ref_measures, target_measures):
        ref_mains = _main_notes(ref_m)
        tgt_mains = _main_notes(tgt_m)

        if len(ref_mains) != len(tgt_mains):
            log.debug(
                "measure %s: note count mismatch (ref=%d tgt=%d) — skipping",
                tgt_m.get("number", "?"), len(ref_mains), len(tgt_mains),
            )
            result.append(tgt_m)
            continue

        tgt_copy = copy.deepcopy(tgt_m)
        tgt_copy_mains = _main_notes(tgt_copy)

        changed = 0
        for ref_note, tgt_note in zip(ref_mains, tgt_copy_mains):
            if ref_note.find("rest") is not None or tgt_note.find("rest") is not None:
                continue
            note_type = ref_note.findtext("type")
            if not note_type:
                continue
            has_dot = ref_note.find("dot") is not None
            _apply_rhythm(tgt_note, note_type, has_dot, tgt_div)
            for chord_note in _chord_notes_after(tgt_copy, tgt_note):
                _apply_rhythm(chord_note, note_type, has_dot, tgt_div)
            changed += 1

        if changed:
            log.info("measure %s: aligned %d note(s) rhythm to reference", tgt_m.get("number", "?"), changed)
        result.append(tgt_copy)

    # Preserve any extra target measures beyond ref length
    result.extend(target_measures[len(result):])
    return result
