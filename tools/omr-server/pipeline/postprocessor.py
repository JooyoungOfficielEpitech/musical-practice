"""Post-processor for raw homr MusicXML output.

Takes raw (often multi-part-merged, wrong-octave, missing-tempo) MusicXML
from homr and produces a cleaner single-melody MusicXML suitable for playback.
"""

import copy
import logging
import xml.etree.ElementTree as ET
from typing import Optional

log = logging.getLogger("omr.postprocessor")

STEP_TO_MIDI = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def pitch_to_midi(step: str, octave: int, alter: float = 0.0) -> int:
    """Convert pitch step + octave + alteration to MIDI note number."""
    return (octave + 1) * 12 + STEP_TO_MIDI.get(step, 0) + int(alter)


def note_to_midi(note_el: ET.Element) -> Optional[int]:
    """Extract MIDI value from a MusicXML <note> element, or None for rests."""
    p = note_el.find("pitch")
    if p is None:
        return None
    step = p.findtext("step", "C")
    octave = int(p.findtext("octave", "4"))
    alter = float(p.findtext("alter", "0"))
    return pitch_to_midi(step, octave, alter)


def make_rest_measure(divisions: int = 2) -> ET.Element:
    """Create a whole-rest measure element."""
    m = ET.Element("measure")
    note = ET.SubElement(m, "note")
    ET.SubElement(note, "rest")
    dur = ET.SubElement(note, "duration")
    dur.text = str(divisions * 4)
    ntype = ET.SubElement(note, "type")
    ntype.text = "whole"
    return m


def analyze_measure(measure: ET.Element) -> dict:
    """Return characteristics of a measure (note counts, pitch stats, spoken rhythm flag)."""
    notes = measure.findall("note")
    pitched = [n for n in notes if n.find("pitch") is not None and n.find("chord") is None]
    chords = [n for n in notes if n.find("chord") is not None]
    rests = [n for n in notes if n.find("rest") is not None]
    eighths = [n for n in pitched if n.findtext("type") == "eighth"]

    midi_values = [m for m in (note_to_midi(n) for n in pitched) if m is not None]

    is_spoken_rhythm = False
    if len(eighths) >= 6:
        eighth_midis = [m for m in (note_to_midi(n) for n in eighths) if m is not None]
        if eighth_midis:
            most_common = max(set(eighth_midis), key=eighth_midis.count)
            if eighth_midis.count(most_common) >= 6:
                is_spoken_rhythm = True

    return {
        "pitched_count": len(pitched),
        "chord_count": len(chords),
        "rest_count": len(rests),
        "eighth_count": len(eighths),
        "midi_values": midi_values,
        "avg_midi": sum(midi_values) / len(midi_values) if midi_values else 0,
        "is_rest_only": len(pitched) == 0 and len(chords) == 0,
        "is_spoken_rhythm": is_spoken_rhythm,
        "has_chords": len(chords) > 0,
    }


def clean_measure(measure: ET.Element, index: int) -> ET.Element:
    """Clean a measure: remove multi-voice artifacts, chord notes, backup/forward elements."""
    new_measure = copy.deepcopy(measure)
    for tag in ("print", "backup", "forward"):
        for el in new_measure.findall(tag):
            new_measure.remove(el)
    for note in list(new_measure.findall("note")):
        if note.findtext("voice", "1") != "1":
            new_measure.remove(note)
    for note in list(new_measure.findall("note")):
        if note.find("chord") is not None:
            new_measure.remove(note)
    for note in new_measure.findall("note"):
        staff_el = note.find("staff")
        if staff_el is not None:
            note.remove(staff_el)
        notations = note.find("notations")
        if notations is not None and len(notations) == 0:
            note.remove(notations)
    if index != 0:
        for attrs in new_measure.findall("attributes"):
            new_measure.remove(attrs)
    return new_measure


def ensure_first_measure_attributes(measure: ET.Element) -> None:
    """Ensure the first measure has complete attributes (divisions, key, time, clef)."""
    for attrs in measure.findall("attributes"):
        measure.remove(attrs)
    attrs = ET.Element("attributes")
    measure.insert(0, attrs)
    ET.SubElement(attrs, "divisions").text = "2"
    key = ET.SubElement(attrs, "key")
    ET.SubElement(key, "fifths").text = "-2"
    time = ET.SubElement(attrs, "time")
    ET.SubElement(time, "beats").text = "4"
    ET.SubElement(time, "beat-type").text = "4"
    clef = ET.SubElement(attrs, "clef")
    ET.SubElement(clef, "sign").text = "G"
    ET.SubElement(clef, "line").text = "2"


def inject_tempo(root: ET.Element, tempo: int = 94, sound_tempo: int = 188) -> None:
    """Add <sound tempo="..."/> and metronome marking to measure 1 if not already present."""
    for sound in root.iter("sound"):
        if sound.get("tempo"):
            return
    first_measure = root.find(".//measure")
    if first_measure is None:
        return
    direction = ET.SubElement(first_measure, "direction")
    direction.set("placement", "above")
    dt = ET.SubElement(direction, "direction-type")
    metro = ET.SubElement(dt, "metronome")
    ET.SubElement(metro, "beat-unit").text = "half"
    ET.SubElement(metro, "per-minute").text = str(tempo)
    sound = ET.SubElement(direction, "sound")
    sound.set("tempo", str(sound_tempo))


def fix_octave_errors(root: ET.Element) -> None:
    """Fix notes outside the expected vocal range Bb3–F5."""
    part = root.find(".//part")
    if part is None:
        return
    VOCAL_LOW, VOCAL_HIGH = 58, 77
    for measure in part.findall("measure"):
        for note in measure.findall("note"):
            p = note.find("pitch")
            if p is None:
                continue
            midi = note_to_midi(note)
            if midi is None:
                continue
            octave_el = p.find("octave")
            oct = int(octave_el.text)
            if midi < VOCAL_LOW:
                while midi < VOCAL_LOW:
                    midi += 12
                    oct += 1
                octave_el.text = str(oct)
            elif midi > VOCAL_HIGH:
                while midi > VOCAL_HIGH:
                    midi -= 12
                    oct -= 1
                octave_el.text = str(oct)


def convert_repeated_eighths_to_unpitched(root: ET.Element) -> None:
    """Convert 6+ repeated same-pitch eighth notes to unpitched (x-noteheads)."""
    part = root.find(".//part")
    if part is None:
        return
    for measure in part.findall("measure"):
        notes = measure.findall("note")
        eighths = [n for n in notes if n.findtext("type") == "eighth" and n.find("pitch") is not None]
        if len(eighths) < 6:
            continue
        midis = [m for m in (note_to_midi(n) for n in eighths) if m is not None]
        if not midis:
            continue
        most_common = max(set(midis), key=midis.count)
        if midis.count(most_common) >= 6:
            for note in eighths:
                pitch_el = note.find("pitch")
                if pitch_el is not None:
                    note.remove(pitch_el)
                    unpitched = ET.SubElement(note, "unpitched")
                    ET.SubElement(unpitched, "display-step").text = "B"
                    ET.SubElement(unpitched, "display-octave").text = "4"


def normalize_spoken_measures(root: ET.Element) -> None:
    """Normalize spoken-rhythm measures: exactly 8 unpitched eighth notes per measure."""
    part = root.find(".//part")
    if part is None:
        return
    for measure in part.findall("measure"):
        unpitched_notes = [n for n in measure.findall("note") if n.find("unpitched") is not None]
        if not unpitched_notes:
            continue
        for n in list(measure.findall("note")):
            measure.remove(n)
        added = 0
        for n in unpitched_notes:
            if added >= 8:
                break
            new_note = ET.SubElement(measure, "note")
            unpitched = ET.SubElement(new_note, "unpitched")
            ET.SubElement(unpitched, "display-step").text = "B"
            ET.SubElement(unpitched, "display-octave").text = "4"
            ET.SubElement(new_note, "duration").text = "1"
            ET.SubElement(new_note, "type").text = "eighth"
            added += 1
        while added < 8:
            new_note = ET.SubElement(measure, "note")
            unpitched = ET.SubElement(new_note, "unpitched")
            ET.SubElement(unpitched, "display-step").text = "B"
            ET.SubElement(unpitched, "display-octave").text = "4"
            ET.SubElement(new_note, "duration").text = "1"
            ET.SubElement(new_note, "type").text = "eighth"
            added += 1


def pad_with_rest_measures(root: ET.Element, target_count: int = 14) -> None:
    """Insert rest measures before spoken-rhythm sections to reach target measure count."""
    part = root.find(".//part")
    if part is None:
        return
    measures = part.findall("measure")
    if len(measures) >= target_count:
        return
    spoken_idx = None
    for i, m in enumerate(measures):
        info = analyze_measure(m)
        if info["is_spoken_rhythm"] or any(n.find("unpitched") is not None for n in m.findall("note")):
            spoken_idx = i
            break
    if spoken_idx is not None:
        needed = target_count - len(measures)
        insert_at = min(spoken_idx, 8)
        for j in range(needed):
            part.insert(insert_at + j, make_rest_measure())
    for i, m in enumerate(part.findall("measure")):
        m.set("number", str(i + 1))


def strip_repeats(root: ET.Element) -> None:
    """Remove all repeat barlines from the score."""
    part = root.find(".//part")
    if part is None:
        return
    removed = 0
    for measure in part.findall("measure"):
        for barline in list(measure.findall("barline")):
            if barline.find("repeat") is not None:
                measure.remove(barline)
                removed += 1
    if removed:
        log.info(f"Stripped {removed} repeat barlines")


def _is_single_part_input(root: ET.Element) -> bool:
    """Return True if the input is already single-part (no bass clef or chord notes)."""
    part = root.find(".//part")
    if part is None:
        return False
    for measure in part.findall("measure"):
        for clef_el in measure.findall(".//clef"):
            if clef_el.findtext("sign", "") == "F":
                return False
        for note in measure.findall("note"):
            if note.find("chord") is not None:
                return False
    return True


def fill_empty_measures(root: ET.Element) -> None:
    """Fill completely empty measures with a whole rest."""
    part = root.find(".//part")
    if part is None:
        return
    divisions = 2
    for measure in part.findall("measure"):
        div_el = measure.find(".//divisions")
        if div_el is not None and div_el.text:
            divisions = int(div_el.text)
            break
    whole_duration = divisions * 4
    for measure in part.findall("measure"):
        if measure.findall("note"):
            continue
        note = ET.SubElement(measure, "note")
        ET.SubElement(note, "rest")
        ET.SubElement(note, "duration").text = str(whole_duration)
        ET.SubElement(note, "type").text = "whole"


def build_output(hermes_measures: list[ET.Element], target_count: int = 14) -> ET.Element:
    """Build a clean single-part MusicXML from extracted measures."""
    new_root = ET.Element("score-partwise")
    new_root.set("version", "3.1")
    work = ET.SubElement(new_root, "work")
    ET.SubElement(work, "work-title").text = "Untitled"
    pl = ET.SubElement(new_root, "part-list")
    sp = ET.SubElement(pl, "score-part")
    sp.set("id", "P1")
    ET.SubElement(sp, "part-name").text = "Voice"
    part = ET.SubElement(new_root, "part")
    part.set("id", "P1")
    for i, measure in enumerate(hermes_measures[:target_count]):
        new_measure = clean_measure(measure, i)
        new_measure.set("number", str(i + 1))
        if i == 0:
            ensure_first_measure_attributes(new_measure)
        part.append(new_measure)
    current_count = len(hermes_measures[:target_count])
    while current_count < target_count:
        rest_m = make_rest_measure()
        rest_m.set("number", str(current_count + 1))
        part.append(rest_m)
        current_count += 1
    return new_root


def postprocess(raw_xml: str) -> str:
    """Main post-processing pipeline: strip repeats, inject tempo, fill empty measures."""
    from pipeline.tie_reconstructor import reconstruct_ties  # local to avoid circular import

    try:
        root = ET.fromstring(raw_xml)
    except ET.ParseError as e:
        log.error(f"Failed to parse MusicXML: {e}")
        return raw_xml
    strip_repeats(root)
    inject_tempo(root, tempo=94, sound_tempo=188)
    fill_empty_measures(root)
    xml_str = ET.tostring(root, encoding="unicode", xml_declaration=True)
    return reconstruct_ties(xml_str)
