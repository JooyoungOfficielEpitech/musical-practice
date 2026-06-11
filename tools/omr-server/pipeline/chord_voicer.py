"""Reduce chords in a separated voice's MusicXML to a single melodic line.

After image-level voice separation, shared (ambiguous) chords remain in BOTH
voice images. homr then emits them as <chord> groups in each voice's XML.
The upper voice keeps the TOP note of each chord, the lower voice keeps the
BOTTOM note — single notes and rests pass through unchanged.
"""

import copy
import logging
import xml.etree.ElementTree as ET

from pipeline.voice_splitter import _note_midi

log = logging.getLogger("omr.chord_voicer")


def _chord_groups(measure: ET.Element) -> list[list[ET.Element]]:
    """Group notes into [main note + following <chord> notes] clusters."""
    groups: list[list[ET.Element]] = []
    for note in measure.findall("note"):
        if note.find("chord") is not None and groups:
            groups[-1].append(note)
        else:
            groups.append([note])
    return groups


def take_voice(xml_string: str, which: str) -> str:
    """Keep one line of every chord: 'upper' keeps the top note, 'lower' the bottom.

    Args:
        xml_string: MusicXML for one separated voice.
        which: "upper" or "lower".

    Returns:
        New MusicXML string with chords reduced to single notes. The input is
        returned unchanged on parse errors.
    """
    if which not in ("upper", "lower"):
        raise ValueError(f"which must be 'upper' or 'lower', got {which!r}")

    try:
        root = ET.fromstring(xml_string)
    except ET.ParseError as exc:
        log.error(f"take_voice: failed to parse XML: {exc}")
        return xml_string

    root = copy.deepcopy(root)
    reduced = 0
    for measure in root.findall(".//part/measure"):
        for group in _chord_groups(measure):
            pitched = [n for n in group if n.find("pitch") is not None]
            if len(pitched) < 2:
                continue
            key = max if which == "upper" else min
            keep = key(pitched, key=lambda n: _note_midi(n) or 0)
            for note in pitched:
                if note is not keep:
                    measure.remove(note)
            chord_el = keep.find("chord")
            if chord_el is not None:
                keep.remove(chord_el)
            reduced += 1

    if reduced:
        log.info(f"take_voice({which}): reduced {reduced} chord groups")
    return ET.tostring(root, encoding="unicode", xml_declaration=True)
