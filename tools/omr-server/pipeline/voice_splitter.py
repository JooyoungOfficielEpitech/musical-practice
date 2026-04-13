"""Split a multi-voice MusicXML into separate single-voice MusicXML strings.

In SATB choral staves, voice 1 (stems up) = upper voice, voice 2 (stems down) = lower voice.
"""

import copy
import logging
import xml.etree.ElementTree as ET

log = logging.getLogger("omr.voice_splitter")


def split_voices(xml_string: str) -> dict[str, str]:
    """Split multi-voice MusicXML into separate single-voice MusicXML strings.

    Returns:
        Dict like {"voice1": xml_str, "voice2": xml_str}.
        Falls back to {"voice1": xml_string} on parse error or single voice.
    """
    try:
        root = ET.fromstring(xml_string)
    except ET.ParseError as e:
        log.error(f"split_voices: failed to parse XML: {e}")
        return {"voice1": xml_string}

    part = root.find(".//part")
    if part is None:
        return {"voice1": xml_string}

    all_voices: set[str] = set()
    for measure in part.findall("measure"):
        for note in measure.findall("note"):
            voice_el = note.find("voice")
            all_voices.add(voice_el.text if voice_el is not None else "1")

    if len(all_voices) <= 1:
        return {"voice1": xml_string}

    voice_ids = sorted(all_voices)

    divisions = 2
    for measure in part.findall("measure"):
        div_el = measure.find(".//divisions")
        if div_el is not None and div_el.text:
            divisions = int(div_el.text)
            break

    whole_duration = divisions * 4

    results: dict[str, str] = {}
    for voice_id in voice_ids:
        voice_root = copy.deepcopy(root)
        voice_part = voice_root.find(".//part")

        for measure in voice_part.findall("measure"):
            has_notes = False
            for child in list(measure):
                if child.tag == "note":
                    voice_el = child.find("voice")
                    v = voice_el.text if voice_el is not None else "1"
                    if v != voice_id:
                        measure.remove(child)
                    else:
                        has_notes = True
                        if voice_el is not None:
                            child.remove(voice_el)
                        staff_el = child.find("staff")
                        if staff_el is not None:
                            child.remove(staff_el)
                elif child.tag in ("backup", "forward"):
                    measure.remove(child)

            if not has_notes:
                note = ET.SubElement(measure, "note")
                ET.SubElement(note, "rest")
                ET.SubElement(note, "duration").text = str(whole_duration)
                ET.SubElement(note, "type").text = "whole"

        voice_key = f"voice{voice_ids.index(voice_id) + 1}"
        results[voice_key] = ET.tostring(voice_root, encoding="unicode", xml_declaration=True)

    return results
