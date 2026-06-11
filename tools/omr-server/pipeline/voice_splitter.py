"""Split a multi-voice MusicXML into separate single-voice MusicXML strings.

Strategy:
  1. Try splitting by <voice> number (homr outputs voice 1 stems-up, voice 2 stems-down).
  2. If only one voice is found, fall back to splitting by chord:
     - The main note (no <chord> tag) → voice1 (upper: S or T)
     - The <chord> note → voice2 (lower: A or B)
     This handles the case where homr collapses two voices into chords.
"""

import copy
import logging
import xml.etree.ElementTree as ET

log = logging.getLogger("omr.voice_splitter")

STEP_TO_MIDI = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def _note_midi(note_el: ET.Element) -> int | None:
    p = note_el.find("pitch")
    if p is None:
        return None
    step = p.findtext("step", "C")
    octave = int(p.findtext("octave", "4"))
    alter = int(float(p.findtext("alter", "0")))
    return (octave + 1) * 12 + STEP_TO_MIDI.get(step, 0) + alter


def _split_by_voice(part: ET.Element, root: ET.Element) -> dict[str, str] | None:
    """Split by <voice> element. Returns None if only one voice found."""
    all_voices: set[str] = set()
    for measure in part.findall("measure"):
        for note in measure.findall("note"):
            v = note.findtext("voice", "1")
            all_voices.add(v)

    if len(all_voices) <= 1:
        return None

    voice_ids = sorted(all_voices)
    divisions = _get_divisions(part)
    whole_duration = divisions * 4
    results: dict[str, str] = {}

    for voice_id in voice_ids:
        voice_root = copy.deepcopy(root)
        voice_part = voice_root.find(".//part")
        for measure in voice_part.findall("measure"):
            has_notes = False
            for child in list(measure):
                if child.tag == "note":
                    v = child.findtext("voice", "1")
                    if v != voice_id:
                        measure.remove(child)
                    else:
                        has_notes = True
                        for tag in ("voice", "staff"):
                            el = child.find(tag)
                            if el is not None:
                                child.remove(el)
                elif child.tag in ("backup", "forward"):
                    measure.remove(child)
            if not has_notes:
                _add_whole_rest(measure, whole_duration)

        idx = voice_ids.index(voice_id)
        results[f"voice{idx + 1}"] = ET.tostring(voice_root, encoding="unicode", xml_declaration=True)

    return results


def _split_by_chord(part: ET.Element, root: ET.Element) -> dict[str, str]:
    """Split chords: main note → voice1 (upper), chord note → voice2 (lower).

    Each measure is processed note-group by note-group. A note-group is a
    main note (no <chord>) plus all immediately following <chord> notes.
    The highest-pitched note in each group → voice1, next highest → voice2.
    Rests are duplicated to both voices.
    """
    divisions = _get_divisions(part)
    whole_duration = divisions * 4

    v1_root = copy.deepcopy(root)
    v2_root = copy.deepcopy(root)
    v1_part = v1_root.find(".//part")
    v2_part = v2_root.find(".//part")

    # Clear all notes (and multi-voice bookkeeping) from copies — we'll repopulate
    for vpart in (v1_part, v2_part):
        for measure in vpart.findall("measure"):
            for child in list(measure):
                if child.tag in ("note", "backup", "forward"):
                    measure.remove(child)

    orig_measures = part.findall("measure")
    v1_measures = v1_part.findall("measure")
    v2_measures = v2_part.findall("measure")

    for orig_m, v1_m, v2_m in zip(orig_measures, v1_measures, v2_measures):
        notes = orig_m.findall("note")
        # Group: collect consecutive chord groups
        groups: list[list[ET.Element]] = []
        for note in notes:
            if note.find("chord") is not None:
                if groups:
                    groups[-1].append(note)
                # else orphan chord — skip
            else:
                groups.append([note])

        v1_has, v2_has = False, False
        for group in groups:
            main = group[0]
            # rest → put in both voices
            if main.find("rest") is not None:
                v1_m.append(copy.deepcopy(main))
                rest2 = copy.deepcopy(main)
                # remove chord tag if present
                chord_el = rest2.find("chord")
                if chord_el is not None:
                    rest2.remove(chord_el)
                v2_m.append(rest2)
                v1_has = v2_has = True
                continue

            # pitched group — sort by MIDI descending (highest = voice1/upper)
            pitched = [(n, _note_midi(n) or 0) for n in group if n.find("pitch") is not None]
            pitched.sort(key=lambda x: -x[1])

            if len(pitched) >= 1:
                n1 = copy.deepcopy(pitched[0][0])
                chord_el = n1.find("chord")
                if chord_el is not None:
                    n1.remove(chord_el)
                v1_m.append(n1)
                v1_has = True

            if len(pitched) >= 2:
                n2 = copy.deepcopy(pitched[1][0])
                chord_el = n2.find("chord")
                if chord_el is not None:
                    n2.remove(chord_el)
                v2_m.append(n2)
                v2_has = True

        if not v1_has:
            _add_whole_rest(v1_m, whole_duration)
        if not v2_has:
            _add_whole_rest(v2_m, whole_duration)

    log.info("split_by_chord: split %d measures into 2 voices", len(orig_measures))
    return {
        "voice1": ET.tostring(v1_root, encoding="unicode", xml_declaration=True),
        "voice2": ET.tostring(v2_root, encoding="unicode", xml_declaration=True),
    }


def _count_pitched(xml_string: str) -> int:
    try:
        root = ET.fromstring(xml_string)
    except ET.ParseError:
        return 0
    return sum(1 for n in root.findall(".//note") if n.find("pitch") is not None)


def _is_degenerate_split(result: dict[str, str], has_chords: bool) -> bool:
    """A voice-number split is degenerate when one voice is a stray remnant.

    homr sometimes tags a single note voice=2 while all real two-voice
    content sits as chords in voice 1 — the voice split then starves voice2.
    When chords exist to split on, prefer the chord split in that case.
    """
    if not has_chords or len(result) < 2:
        return False
    counts = sorted(_count_pitched(xml) for xml in result.values())
    return counts[0] < 2 and counts[-1] >= 4


def _get_divisions(part: ET.Element) -> int:
    for measure in part.findall("measure"):
        div_el = measure.find(".//divisions")
        if div_el is not None and div_el.text:
            return int(div_el.text)
    return 2


def _add_whole_rest(measure: ET.Element, whole_duration: int) -> None:
    note = ET.SubElement(measure, "note")
    ET.SubElement(note, "rest")
    ET.SubElement(note, "duration").text = str(whole_duration)
    ET.SubElement(note, "type").text = "whole"


def split_voices(xml_string: str) -> dict[str, str]:
    """Split multi-voice MusicXML into separate single-voice MusicXML strings.

    Returns:
        Dict like {"voice1": xml_str, "voice2": xml_str}.
        Falls back to {"voice1": xml_string} on parse error.
    """
    try:
        root = ET.fromstring(xml_string)
    except ET.ParseError as e:
        log.error(f"split_voices: failed to parse XML: {e}")
        return {"voice1": xml_string}

    part = root.find(".//part")
    if part is None:
        return {"voice1": xml_string}

    has_chords = any(
        note.find("chord") is not None
        for measure in part.findall("measure")
        for note in measure.findall("note")
    )

    # Try voice-number split first
    result = _split_by_voice(part, root)
    if result is not None and not _is_degenerate_split(result, has_chords):
        log.info("split_voices: split by voice number (%d voices)", len(result))
        return result
    if result is not None:
        log.info("split_voices: voice-number split degenerate — using chord split")

    if has_chords:
        log.info("split_voices: single voice with chords — splitting by pitch")
        return _split_by_chord(part, root)

    log.info("split_voices: single voice, no chords — returning as voice1")
    return {"voice1": xml_string}
